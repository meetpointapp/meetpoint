import { RtcRole, RtcTokenBuilder } from 'agora-token';
import type { Call, Photo, Prisma, Profile, User } from '@prisma/client';
import { agora, callTiming, economy, type CallKind } from './config';
import { fileReport } from './moderation/reports';
import { hasConsent, requireConsent } from './privacy/consents';
import { HttpError, isBlockedEitherWay, prisma } from './db';
import { notify } from './notify';
import { emitToUser, isOnline, onUserOffline, onUserOnline } from './realtime';
import { publicProfile } from './routes/profile';
import { getBalance, refundCallCharge, transfer } from './wallet';

// Sesli/görüntülü arama yaşam döngüsü:
//   RINGING → ACTIVE → ENDED   (normal)
//   RINGING → DECLINED | CANCELLED | MISSED
// Dakika başı ücret: her dakikanın BAŞINDA arayandan alınır ve arananın hesabına (EARN) geçer.
// Bakiye bir sonraki dakikaya yetmezse arama biter.
//
// Zamanlamalar (cevapsız sayılma, dakika ücreti, bağlantı kopması) bellekte değil veritabanında
// (ringDeadline, nextBillingAt, callerGraceAt, calleeGraceAt). Zamanı gelen işleri zamanlayıcı
// (scheduler.ts) işler: sunucu yeniden başlasa veya birden fazla sunucu çalışsa da arama ve
// ücretlendirme kaldığı yerden devam eder. Her geçiş koşullu güncelleme veya satır kilidiyle yapılır:
// aynı arama iki kez kabul edilemez, aynı dakika iki kez ücretlendirilemez.

const LIVE = ['RINGING', 'ACTIVE'];
const secondsFromNow = (s: number, now = Date.now()) => new Date(now + s * 1000);

type Tx = Prisma.TransactionClient;
type UserWithProfile = User & { profile: Profile | null; photos: Photo[] };
type CallWithUsers = Call & { caller: UserWithProfile; callee: UserWithProfile };
const withUsers = { caller: { include: { profile: true, photos: true } }, callee: { include: { profile: true, photos: true } } } as const;

// Ses/görüntü kanalına katılım bilgisi. Agora ayarlı değilse null (simülasyon modu).
function mediaFor(callId: string, uid: number) {
  if (!agora.appId) return null;
  const expire = 3600;
  const token = agora.appCertificate
    ? RtcTokenBuilder.buildTokenWithUid(agora.appId, agora.appCertificate, callId, uid, RtcRole.PUBLISHER, expire, expire)
    : null;
  return { appId: agora.appId, channel: callId, uid, token };
}

// Faz 15 · uzun ve kesintisiz aramalar: Agora jetonu 1 saat sonra geçersiz olur. Uygulama, jeton süresi
// dolmadan (onTokenPrivilegeWillExpire) bunu çağırıp yeni jeton alır; arama sürerken kanaldan
// düşmeden yenilenir.
export async function renewMediaToken(id: string, userId: string) {
  const call = await prisma.call.findUnique({ where: { id } });
  if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new HttpError(404, 'not_found');
  if (call.status !== 'ACTIVE') throw new HttpError(409, 'call_not_active');
  const media = mediaFor(id, call.callerId === userId ? 1 : 2);
  if (!media) throw new HttpError(409, 'no_media');
  return media;
}

export function callDto(call: CallWithUsers, viewerId: string) {
  const outgoing = call.callerId === viewerId;
  return {
    id: call.id,
    kind: call.kind,
    direction: outgoing ? 'out' : 'in',
    status: call.status,
    endReason: call.endReason,
    ratePerMin: call.ratePerMin,
    billedMinutes: call.billedMinutes,
    totalCoins: call.totalCoins,
    giftCoins: call.giftCoins,
    myRating: outgoing ? call.callerRating : call.calleeRating,
    createdAt: call.createdAt,
    answeredAt: call.answeredAt,
    endedAt: call.endedAt,
    user: publicProfile(outgoing ? call.callee : call.caller),
  };
}

const load = (id: string) => prisma.call.findUnique({ where: { id }, include: withUsers });

// Canlı aramayı bitiren ortak alanlar: zamanlayıcı son tarihleri temizlenir
const closed = { ringDeadline: null, nextBillingAt: null, callerGraceAt: null, calleeGraceAt: null, mediaConfirmDeadline: null };

async function transition(id: string, from: string[], data: Prisma.CallUpdateManyMutationInput) {
  const { count } = await prisma.call.updateMany({ where: { id, status: { in: from } }, data });
  return count === 1;
}

async function broadcast(id: string, event: string, extra: Record<string, unknown> = {}) {
  const call = await load(id);
  if (!call) return;
  emitToUser(call.callerId, event, { ...callDto(call, call.callerId), ...extra });
  emitToUser(call.calleeId, event, { ...callDto(call, call.calleeId), ...extra });
}

// Kullanıcı başına kilit (işlem süresince): "meşgul mü?" kontrolü ile arama oluşturma arasına
// başka bir arama giremesin. Kilitler her zaman aynı sırayla alınır.
async function lockUsers(tx: Tx, ids: string[]) {
  for (const id of [...ids].sort()) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`user:${id}`}))`;
}

const isBusy = async (tx: Tx, userId: string) =>
  (await tx.call.count({ where: { status: { in: LIVE }, OR: [{ callerId: userId }, { calleeId: userId }] } })) > 0;

export async function startCall(callerId: string, calleeId: string, kind: CallKind) {
  if (callerId === calleeId) throw new HttpError(400, 'invalid_target');
  const callee = await prisma.user.findUnique({ where: { id: calleeId }, include: { profile: true } });
  if (!callee?.profile || callee.bannedAt || callee.deletionRequestedAt || (await isBlockedEitherWay(callerId, calleeId))) {
    throw new HttpError(404, 'not_found');
  }
  // Ses/görüntü yurt dışındaki sunuculardan (Agora) geçer: iki tarafın da rızası gerekir
  await requireConsent(callerId, 'overseas_transfer');
  if (!hasConsent(callee, 'overseas_transfer')) throw new HttpError(409, 'peer_calls_disabled');
  const rate = economy.callRates[kind];
  if ((await getBalance(callerId)) < rate) throw new HttpError(402, 'insufficient_balance');

  const call = await prisma.$transaction(async (tx) => {
    await lockUsers(tx, [callerId, calleeId]);
    if (await isBusy(tx, callerId)) throw new HttpError(409, 'already_in_call');
    if (await isBusy(tx, calleeId)) throw new HttpError(409, 'busy');
    return tx.call.create({
      data: { callerId, calleeId, kind, ratePerMin: rate, ringDeadline: secondsFromNow(callTiming.ringSeconds) },
      include: withUsers,
    });
  });

  emitToUser(calleeId, 'call:incoming', callDto(call, calleeId));
  void notify(calleeId, 'call', callerId, kind, { callId: call.id });
  return callDto(call, callerId);
}

// Zamanı gelmiş dakikanın ücretini al. Satır kilidi: aynı dakika iki kez alınamaz.
// Ses/görüntü Agora üzerinden akar: sunucumuz kısa süre çökse de kullanıcılar konuşmaya devam eder.
// Bu yüzden kısa kesintide (en fazla MAX_CATCHUP dakika) kaçırılan dakikalar her turda bir tane
// olmak üzere tamamlanır. Daha uzun kesintide konuşmanın sürdüğü bilinemez: o süre ücretlendirilmez,
// takvim şimdiden devam eder.
const MAX_CATCHUP = 3;
export async function chargeDueMinute(id: string, now = new Date()): Promise<'charged' | 'ended' | 'skip'> {
  const billingMs = callTiming.billingSeconds * 1000;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "Call" WHERE "id" = ${id} FOR UPDATE`;
    const call = await tx.call.findUnique({ where: { id } });
    if (!call || call.status !== 'ACTIVE' || !call.nextBillingAt || call.nextBillingAt > now) return null;
    try {
      await transfer(tx, call.callerId, call.calleeId, call.ratePerMin, { debit: 'CALL', credit: 'EARN' }, { note: `call:${id}` });
    } catch (e) {
      if (e instanceof HttpError && e.code === 'insufficient_balance') return { ok: false as const, call };
      throw e;
    }
    const longOutage = now.getTime() - call.nextBillingAt.getTime() > billingMs * MAX_CATCHUP;
    const next = new Date((longOutage ? now.getTime() : call.nextBillingAt.getTime()) + billingMs);
    await tx.call.update({
      where: { id },
      data: { billedMinutes: { increment: 1 }, totalCoins: { increment: call.ratePerMin }, nextBillingAt: next },
    });
    return { ok: true as const, call, remaining: await getBalance(call.callerId, tx) };
  });
  if (!result) return 'skip';
  if (!result.ok) {
    await endCall(id, 'balance');
    return 'ended';
  }
  await broadcast(id, 'call:charged');
  // Bir sonraki dakikaya yetmeyecekse arayanı uyar
  if (result.remaining < result.call.ratePerMin) emitToUser(result.call.callerId, 'call:low_balance', { id });
  return 'charged';
}

export async function acceptCall(id: string, userId: string) {
  const call = await load(id);
  if (!call || call.calleeId !== userId) throw new HttpError(404, 'not_found');
  await requireConsent(userId, 'overseas_transfer');
  const now = new Date();
  // İlk dakika kabul anında alınır: ücret anı "şimdi". Agora ayarlıysa, iki taraf da bu süre içinde
  // kanala katılmazsa chargeDueMinute'ün aldığı ücret tamamen iade edilir (bkz. processCallDeadlines).
  const mediaConfirmDeadline = agora.appId ? secondsFromNow(callTiming.mediaConfirmSeconds, now.getTime()) : null;
  if (
    !(await transition(id, ['RINGING'], {
      status: 'ACTIVE',
      answeredAt: now,
      ringDeadline: null,
      nextBillingAt: now,
      mediaConfirmDeadline,
    }))
  ) {
    throw new HttpError(409, 'call_not_ringing');
  }
  if ((await chargeDueMinute(id, now)) === 'ended') throw new HttpError(402, 'caller_insufficient_balance');

  const fresh = (await load(id))!;
  emitToUser(call.callerId, 'call:accepted', { ...callDto(fresh, call.callerId), media: mediaFor(id, 1) });
  return { ...callDto(fresh, userId), media: mediaFor(id, 2) };
}

// Faz 15 · adil ücretlendirme: arama ödenmiş bir dakikanın ortasında biterse (hangup/disconnect),
// o dakikanın kullanılmayan kısmı saniye bazlı orantılı iade edilir. Bağlantı hiç kurulamadıysa
// (connect_failed) alınan ücretin tamamı iade edilir. Bakiye yetmezliğinde (balance) zaten tam
// dakika ücretlendirilmişti, iade yok.
function partialRefund(call: Pick<Call, 'ratePerMin' | 'nextBillingAt' | 'totalCoins'>, reason: string, now: Date) {
  if (reason === 'connect_failed') return call.totalCoins;
  if (reason === 'balance' || !call.nextBillingAt || call.nextBillingAt <= now) return 0;
  const billingMs = callTiming.billingSeconds * 1000;
  const unusedMs = call.nextBillingAt.getTime() - now.getTime();
  return Math.round(call.ratePerMin * Math.min(1, unusedMs / billingMs));
}

export async function endCall(
  id: string,
  reason: 'hangup' | 'balance' | 'disconnect' | 'server_restart' | 'connect_failed',
  now = new Date(),
) {
  // Satır kilidiyle tek işlemde yapılır: zamanlayıcının aynı anda bu dakikayı ücretlendirmesiyle
  // yarışmasın (eski değeri okuyup yanlış iade hesaplamayı önler).
  const ended = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "Call" WHERE "id" = ${id} FOR UPDATE`;
    const call = await tx.call.findUnique({ where: { id } });
    if (!call || call.status !== 'ACTIVE') return false;
    await tx.call.update({ where: { id }, data: { status: 'ENDED', endReason: reason, endedAt: now, ...closed } });
    const refund = partialRefund(call, reason, now);
    if (refund > 0) {
      await refundCallCharge(tx, id, call.callerId, call.calleeId, refund);
      await tx.call.update({ where: { id }, data: { totalCoins: { decrement: refund } } });
    }
    return true;
  });
  if (ended) await broadcast(id, 'call:ended');
  return ended;
}

// Uygulama, ses/görüntü motoru Agora kanalına gerçekten katıldığını doğrulayınca çağırır
// (simülasyon modunda da anında çağrılır). Agora ayarlıysa ve süre dolana kadar iki taraf da
// katılmazsa arama processCallDeadlines tarafından "bağlantı kurulamadı" sayılıp ücret iade edilir.
export async function confirmJoined(id: string, userId: string) {
  const call = await prisma.call.findUnique({ where: { id } });
  if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new HttpError(404, 'not_found');
  if (call.status !== 'ACTIVE') return { ok: true };
  const field = call.callerId === userId ? 'callerJoinedAt' : 'calleeJoinedAt';
  if (!call[field]) await prisma.call.update({ where: { id }, data: { [field]: new Date() } });
  return { ok: true };
}

async function missCall(id: string) {
  if (await transition(id, ['RINGING'], { status: 'MISSED', endedAt: new Date(), ...closed })) {
    await broadcast(id, 'call:ended');
  }
}

// Kapat: çalarken arayan → iptal, aranan → ret; aktif aramada → bitir
export async function hangUp(id: string, userId: string) {
  const call = await prisma.call.findUnique({ where: { id } });
  if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new HttpError(404, 'not_found');
  if (call.status === 'RINGING') {
    const status = call.callerId === userId ? 'CANCELLED' : 'DECLINED';
    if (await transition(id, ['RINGING'], { status, endedAt: new Date(), ...closed })) {
      await broadcast(id, 'call:ended');
    }
  } else if (call.status === 'ACTIVE') {
    await endCall(id, 'hangup');
  }
  return callDto((await load(id))!, userId);
}

export async function sendGift(id: string, fromId: string, giftId: string) {
  const gift = economy.gifts.find((g) => g.id === giftId);
  if (!gift) throw new HttpError(400, 'invalid_gift');
  const call = await prisma.call.findUnique({ where: { id } });
  if (!call || (call.callerId !== fromId && call.calleeId !== fromId)) throw new HttpError(404, 'not_found');
  if (call.status !== 'ACTIVE') throw new HttpError(409, 'call_not_active');
  const toId = call.callerId === fromId ? call.calleeId : call.callerId;

  await prisma.$transaction(async (tx) => {
    await transfer(tx, fromId, toId, gift.coins, { debit: 'GIFT', credit: 'EARN' }, { note: `gift:${id}:${gift.id}` });
    await tx.callGift.create({ data: { callId: id, fromId, toId, giftId: gift.id, coins: gift.coins } });
    await tx.call.update({ where: { id }, data: { giftCoins: { increment: gift.coins } } });
  });
  const payload = { callId: id, giftId: gift.id, emoji: gift.emoji, coins: gift.coins, fromId };
  emitToUser(fromId, 'call:gift', payload);
  emitToUser(toId, 'call:gift', payload);
  return { balance: await getBalance(fromId) };
}

// Arama sonrası puan (1-5) ve isteğe bağlı sorun bildirimi. Her taraf bir kez puanlar.
export async function rateCall(id: string, userId: string, rating: number, reportReason?: string) {
  const call = await prisma.call.findUnique({ where: { id } });
  if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new HttpError(404, 'not_found');
  if (call.status !== 'ENDED') throw new HttpError(409, 'call_not_ended');
  const asCaller = call.callerId === userId;
  if ((asCaller ? call.callerRating : call.calleeRating) != null) throw new HttpError(409, 'already_rated');
  await prisma.call.update({ where: { id }, data: asCaller ? { callerRating: rating } : { calleeRating: rating } });
  if (reportReason) {
    await fileReport({ fromId: userId, toId: asCaller ? call.calleeId : call.callerId, reason: reportReason, details: `call:${id}` });
  }
}

// Arama içinden "bildir ve kapat": arama hemen biter, şikayet öncelikli kuyruğa düşer
export async function reportAndHangUp(id: string, userId: string, reason: string) {
  const call = await prisma.call.findUnique({ where: { id } });
  if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new HttpError(404, 'not_found');
  const ended = await hangUp(id, userId).catch(() => null);
  const other = call.callerId === userId ? call.calleeId : call.callerId;
  // Arama sırasında yaşanan sorun: en az "yüksek" öncelik
  await fileReport({ fromId: userId, toId: other, reason, details: `call:${id} (arama sırasında)`, priority: reason === 'underage' || reason === 'inappropriate_content' ? 1 : 2 });
  return ended ?? getCall(id, userId);
}

export async function callHistory(userId: string) {
  const calls = await prisma.call.findMany({
    where: { OR: [{ callerId: userId }, { calleeId: userId }] },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: withUsers,
  });
  return calls.map((c) => callDto(c, userId));
}

export async function getCall(id: string, userId: string) {
  const call = await load(id);
  if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new HttpError(404, 'not_found');
  // Görüşme sürerken kanal bilgisi de döner (uygulama "kabul edildi" olayını kaçırdıysa)
  const media = call.status === 'ACTIVE' ? mediaFor(id, call.callerId === userId ? 1 : 2) : undefined;
  return { ...callDto(call, userId), media };
}

// --- Bağlantı kopması: kullanıcı küme genelinde çevrimdışı olunca bekleme süresi başlar,
// geri gelince iptal edilir. Aranan çalarken çevrimdışı olabilir (bildirimle uyanır).
async function markAway(userId: string, until: Date) {
  await prisma.call.updateMany({ where: { status: { in: LIVE }, callerId: userId, callerGraceAt: null }, data: { callerGraceAt: until } });
  await prisma.call.updateMany({ where: { status: 'ACTIVE', calleeId: userId, calleeGraceAt: null }, data: { calleeGraceAt: until } });
}

onUserOffline((userId) => markAway(userId, secondsFromNow(callTiming.disconnectGraceSeconds)));

onUserOnline(async (userId) => {
  await prisma.call.updateMany({ where: { status: { in: LIVE }, callerId: userId, callerGraceAt: { not: null } }, data: { callerGraceAt: null } });
  await prisma.call.updateMany({ where: { status: { in: LIVE }, calleeId: userId, calleeGraceAt: { not: null } }, data: { calleeGraceAt: null } });
});

// --- Zamanlayıcı (sadece lider sunucuda çalışır) ---

// Zamanı gelen son tarihleri işle: cevapsız aramalar, dakika ücretleri, bağlantısı kopanlar
export async function processCallDeadlines(now = new Date()) {
  const ringing = await prisma.call.findMany({ where: { status: 'RINGING', ringDeadline: { lte: now } }, select: { id: true }, take: 200 });
  for (const { id } of ringing) await missCall(id).catch((e) => console.error('missCall', id, e));

  const due = await prisma.call.findMany({ where: { status: 'ACTIVE', nextBillingAt: { lte: now } }, select: { id: true }, take: 500 });
  for (const { id } of due) await chargeDueMinute(id, now).catch((e) => console.error('chargeDueMinute', id, e));

  // Adil ücretlendirme: Agora ayarlıysa, süre dolana kadar iki taraf da kanala katılmadıysa
  // bağlantı hiç kurulamamış sayılır, arama biter ve alınan ücret tamamen iade edilir.
  if (agora.appId) {
    const unconfirmed = await prisma.call.findMany({
      where: { status: 'ACTIVE', mediaConfirmDeadline: { lte: now }, OR: [{ callerJoinedAt: null }, { calleeJoinedAt: null }] },
      select: { id: true },
      take: 200,
    });
    for (const { id } of unconfirmed) await endCall(id, 'connect_failed', now).catch((e) => console.error('connect_failed', id, e));
  }

  const away = await prisma.call.findMany({
    where: { status: { in: LIVE }, OR: [{ callerGraceAt: { lte: now } }, { calleeGraceAt: { lte: now } }] },
    take: 200,
  });
  for (const c of away) {
    for (const [userId, graceAt, field] of [
      [c.callerId, c.callerGraceAt, 'callerGraceAt'],
      [c.calleeId, c.calleeGraceAt, 'calleeGraceAt'],
    ] as const) {
      if (!graceAt || graceAt > now) continue;
      // Son kontrol: bu arada başka bir sunucuya bağlanmış olabilir
      if (await isOnline(userId)) {
        await prisma.call.update({ where: { id: c.id }, data: { [field]: null } });
      } else if (c.status === 'RINGING') {
        await hangUp(c.id, userId).catch(() => {});
      } else {
        await endCall(c.id, 'disconnect');
      }
      break;
    }
  }
}

// Canlı aramalarda taraflar gerçekten bağlı mı? (Çöken bir sunucudaki bağlantılar "koptu" olayı
// üretmez; bu tarama onları yakalar.) Bağlı olmayan taraf için bekleme süresi başlatılır.
export async function sweepCallPresence(now = new Date()) {
  const live = await prisma.call.findMany({ where: { status: { in: LIVE } }, take: 500 });
  const until = secondsFromNow(callTiming.disconnectGraceSeconds, now.getTime());
  for (const c of live) {
    if (!c.callerGraceAt && !(await isOnline(c.callerId))) {
      await prisma.call.updateMany({ where: { id: c.id, callerGraceAt: null }, data: { callerGraceAt: until } });
    }
    if (c.status === 'ACTIVE' && !c.calleeGraceAt && !(await isOnline(c.calleeId))) {
      await prisma.call.updateMany({ where: { id: c.id, calleeGraceAt: null }, data: { calleeGraceAt: until } });
    }
  }
}

// Zamanlayıcı sütunlarından önceki (eski sürüm) yarım kalmış aramalar: kapat
export async function closeLegacyCalls() {
  await prisma.call.updateMany({
    where: { status: 'ACTIVE', nextBillingAt: null },
    data: { status: 'ENDED', endReason: 'server_restart', endedAt: new Date(), ...closed },
  });
  await prisma.call.updateMany({ where: { status: 'RINGING', ringDeadline: null }, data: { status: 'MISSED', endedAt: new Date(), ...closed } });
}
