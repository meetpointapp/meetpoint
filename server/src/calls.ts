import { RtcRole, RtcTokenBuilder } from 'agora-token';
import type { Call, Photo, Profile, User } from '@prisma/client';
import { agora, callTiming, economy, type CallKind } from './config';
import { HttpError, isBlockedEitherWay, prisma } from './db';
import { notify } from './notify';
import { emitToUser, isOnline, onUserOffline } from './realtime';
import { publicProfile } from './routes/profile';
import { getBalance, transfer } from './wallet';

// Sesli/görüntülü arama yaşam döngüsü:
//   RINGING → ACTIVE → ENDED   (normal)
//   RINGING → DECLINED | CANCELLED | MISSED
// Dakika başı ücret: her dakikanın BAŞINDA arayandan alınır ve arananın hesabına (EARN) geçer.
// Bakiye bir sonraki dakikaya yetmezse arama biter. Tüm geçişler koşullu güncellemeyle
// yapılır: aynı arama iki kez kabul edilemez, aynı dakika iki kez ücretlendirilemez.

const LIVE = ['RINGING', 'ACTIVE'];
const timers = new Map<string, { ring?: NodeJS.Timeout; bill?: NodeJS.Timeout; grace?: NodeJS.Timeout }>();

function timerOf(id: string) {
  let t = timers.get(id);
  if (!t) timers.set(id, (t = {}));
  return t;
}

function clearTimers(id: string) {
  const t = timers.get(id);
  if (!t) return;
  if (t.ring) clearTimeout(t.ring);
  if (t.bill) clearInterval(t.bill);
  if (t.grace) clearTimeout(t.grace);
  timers.delete(id);
}

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

async function transition(id: string, from: string[], data: Partial<Call>) {
  const { count } = await prisma.call.updateMany({ where: { id, status: { in: from } }, data });
  return count === 1;
}

async function broadcast(id: string, event: string, extra: Record<string, unknown> = {}) {
  const call = await load(id);
  if (!call) return;
  emitToUser(call.callerId, event, { ...callDto(call, call.callerId), ...extra });
  emitToUser(call.calleeId, event, { ...callDto(call, call.calleeId), ...extra });
}

async function isBusy(userId: string) {
  return (await prisma.call.count({ where: { status: { in: LIVE }, OR: [{ callerId: userId }, { calleeId: userId }] } })) > 0;
}

export async function startCall(callerId: string, calleeId: string, kind: CallKind) {
  if (callerId === calleeId) throw new HttpError(400, 'invalid_target');
  const callee = await prisma.user.findUnique({ where: { id: calleeId }, include: { profile: true } });
  if (!callee?.profile || callee.bannedAt || (await isBlockedEitherWay(callerId, calleeId))) {
    throw new HttpError(404, 'not_found');
  }
  const rate = economy.callRates[kind];
  if ((await getBalance(callerId)) < rate) throw new HttpError(402, 'insufficient_balance');
  if (await isBusy(callerId)) throw new HttpError(409, 'already_in_call');
  if (await isBusy(calleeId)) throw new HttpError(409, 'busy');

  const call = await prisma.call.create({ data: { callerId, calleeId, kind, ratePerMin: rate }, include: withUsers });
  timerOf(call.id).ring = setTimeout(() => void missCall(call.id), callTiming.ringSeconds * 1000);

  emitToUser(calleeId, 'call:incoming', callDto(call, calleeId));
  void notify(calleeId, 'call', callerId, kind, { callId: call.id });
  return callDto(call, callerId);
}

// Dakikanın ücretini al. false: bakiye yetmedi (arama bitirilmeli)
async function chargeMinute(id: string): Promise<boolean> {
  const result = await prisma.$transaction(async (tx) => {
    const call = await tx.call.findUnique({ where: { id } });
    if (!call || call.status !== 'ACTIVE') return null;
    try {
      await transfer(tx, call.callerId, call.calleeId, call.ratePerMin, { debit: 'CALL', credit: 'EARN' }, { note: `call:${id}` });
    } catch (e) {
      if (e instanceof HttpError && e.code === 'insufficient_balance') return { ok: false as const, call };
      throw e;
    }
    await tx.call.update({ where: { id }, data: { billedMinutes: { increment: 1 }, totalCoins: { increment: call.ratePerMin } } });
    return { ok: true as const, call, remaining: await getBalance(call.callerId, tx) };
  });
  if (!result) return false;
  if (!result.ok) return false;
  await broadcast(id, 'call:charged');
  // Bir sonraki dakikaya yetmeyecekse arayanı uyar
  if (result.remaining < result.call.ratePerMin) emitToUser(result.call.callerId, 'call:low_balance', { id });
  return true;
}

export async function acceptCall(id: string, userId: string) {
  const call = await load(id);
  if (!call || call.calleeId !== userId) throw new HttpError(404, 'not_found');
  if (!(await transition(id, ['RINGING'], { status: 'ACTIVE', answeredAt: new Date() }))) {
    throw new HttpError(409, 'call_not_ringing');
  }
  const t = timerOf(id);
  if (t.ring) clearTimeout(t.ring);

  // İlk dakika kabul anında alınır
  if (!(await chargeMinute(id))) {
    await endCall(id, 'balance');
    throw new HttpError(402, 'caller_insufficient_balance');
  }
  t.bill = setInterval(async () => {
    if (!(await chargeMinute(id).catch(() => false))) await endCall(id, 'balance');
  }, callTiming.billingSeconds * 1000);

  const fresh = (await load(id))!;
  emitToUser(call.callerId, 'call:accepted', { ...callDto(fresh, call.callerId), media: mediaFor(id, 1) });
  return { ...callDto(fresh, userId), media: mediaFor(id, 2) };
}

export async function endCall(id: string, reason: 'hangup' | 'balance' | 'disconnect' | 'server_restart') {
  const ended = await transition(id, ['ACTIVE'], { status: 'ENDED', endReason: reason, endedAt: new Date() });
  clearTimers(id);
  if (ended) await broadcast(id, 'call:ended');
  return ended;
}

async function missCall(id: string) {
  if (await transition(id, ['RINGING'], { status: 'MISSED', endedAt: new Date() })) {
    clearTimers(id);
    await broadcast(id, 'call:ended');
  }
}

// Kapat: çalarken arayan → iptal, aranan → ret; aktif aramada → bitir
export async function hangUp(id: string, userId: string) {
  const call = await prisma.call.findUnique({ where: { id } });
  if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new HttpError(404, 'not_found');
  if (call.status === 'RINGING') {
    const status = call.callerId === userId ? 'CANCELLED' : 'DECLINED';
    if (await transition(id, ['RINGING'], { status, endedAt: new Date() })) {
      clearTimers(id);
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
    await prisma.report.create({
      data: { fromId: userId, toId: asCaller ? call.calleeId : call.callerId, reason: reportReason, details: `call:${id}` },
    });
  }
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

// Bağlantısı kopan kullanıcı: kısa bir süre içinde dönmezse aramayı sonlandır
onUserOffline(async (userId) => {
  const calls = await prisma.call.findMany({
    where: { status: { in: LIVE }, OR: [{ callerId: userId }, { calleeId: userId }] },
  });
  for (const c of calls) {
    // Aranan çevrimdışıyken çalmaya devam eder (push ile uyanabilir); diğer durumlar beklemeye alınır
    if (c.status === 'RINGING' && c.calleeId === userId) continue;
    const t = timerOf(c.id);
    if (t.grace) clearTimeout(t.grace);
    t.grace = setTimeout(async () => {
      if (isOnline(userId)) return;
      if (c.status === 'RINGING') await hangUp(c.id, userId).catch(() => {});
      else await endCall(c.id, 'disconnect');
    }, callTiming.disconnectGraceSeconds * 1000);
  }
});

// Sunucu yeniden başlarsa yarım kalan aramaları kapat (zamanlayıcılar bellekteydi)
export async function recoverCalls() {
  await prisma.call.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'ENDED', endReason: 'server_restart', endedAt: new Date() } });
  await prisma.call.updateMany({ where: { status: 'RINGING' }, data: { status: 'MISSED', endedAt: new Date() } });
}
