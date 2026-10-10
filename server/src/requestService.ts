import { checkEarningMilestones } from './achievements';
import { economy } from './config';
import { HttpError, prisma } from './db';
import { applyEarningEventBonus } from './events';
import { emitToUser } from './realtime';
import { credit, earningsFrom, heldBuckets } from './wallet';

// Süresi dolan bekleyen istekleri düşürüp gönderene iade eder.
export async function expireStaleRequests() {
  const stale = await prisma.contactRequest.findMany({
    where: { status: 'PENDING', expiresAt: { lte: new Date() } },
    select: { id: true },
  });
  for (const { id } of stale) {
    await closeRequest(id, 'EXPIRED').catch(() => {});
  }
}

// PENDING bir isteği kapatır (red/iptal/süre dolumu) ve jetonu iade eder.
// updateMany + status koşulu: aynı istek iki kez kapatılıp çift iade yapılamaz.
export async function closeRequest(id: string, status: 'REJECTED' | 'CANCELLED' | 'EXPIRED') {
  const request = await prisma.$transaction(async (tx) => {
    const r = await tx.contactRequest.findUniqueOrThrow({ where: { id } });
    const { count } = await tx.contactRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status, respondedAt: new Date() },
    });
    if (count !== 1) throw new HttpError(409, 'request_not_pending');
    // Bloke edilen jeton, alındığı kovalara aynen geri döner
    const hold = await tx.walletEntry.findFirst({ where: { requestId: id, type: 'HOLD', userId: r.fromId } });
    await credit(tx, r.fromId, hold ? heldBuckets(hold) : { paid: r.price }, 'REFUND', { requestId: id });
    return r;
  });
  emitToUser(request.fromId, 'request:updated', { id, status });
  emitToUser(request.toId, 'request:updated', { id, status });
}

// Bir kullanıcının dahil olduğu tüm bekleyen istekleri kapatır (yasaklama/hesap silme).
// Emanetteki (kabul edilmiş ama jetonu henüz alıcıya geçmemiş) istekler gönderene iade edilir.
export async function closeAllPendingFor(userId: string) {
  const pending = await prisma.contactRequest.findMany({
    where: { status: 'PENDING', OR: [{ fromId: userId }, { toId: userId }] },
    select: { id: true },
  });
  for (const { id } of pending) await closeRequest(id, 'CANCELLED').catch(() => {});
  const escrowed = await prisma.contactRequest.findMany({
    where: { escrow: true, OR: [{ fromId: userId }, { toId: userId }] },
    select: { id: true },
  });
  for (const { id } of escrowed) await refundEscrow(id).catch(() => {});
}

// ---------- Faz 20: mesaj isteği emaneti
// Gönderen mesaj isteği için jeton öder; alıcı kabul edince sohbet açılır ama jeton alıcıya HEMEN geçmez.
// Alıcı anlamlı cevap yazarsa (en az minWords kelimelik `replies` mesaj) jeton alıcıya geçer; yazmazsa
// `days` gün sonra gönderene iade edilir. Böylece "tek kelime yazıp jetonu alma" mümkün olmaz.

// En az minWords kelime (en az bir harf/rakam içeren parçalar) içeren mesaj "anlamlı cevap" sayılır
export function qualifiesAsReply(body: string): boolean {
  const words = body.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words.length >= economy.requestEscrow.minWords;
}

// Alıcı (senderId) bir metin mesajı yazdığında çağrılır. otherId = jetonu ödeyen kişi.
export async function recordEscrowReply(senderId: string, otherId: string, body: string) {
  if (!qualifiesAsReply(body)) return;
  const open = await prisma.contactRequest.findFirst({
    where: { kind: 'MESSAGE', fromId: otherId, toId: senderId, status: 'ACCEPTED', escrow: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!open) return;
  const updated = await prisma.contactRequest.update({ where: { id: open.id }, data: { qualifiedReplies: { increment: 1 } } });
  if (updated.qualifiedReplies >= economy.requestEscrow.replies) {
    await releaseEscrow(open.id);
  } else {
    const payload = { id: open.id, status: 'ACCEPTED', qualifiedReplies: updated.qualifiedReplies };
    emitToUser(open.fromId, 'request:updated', payload);
    emitToUser(open.toId, 'request:updated', payload);
  }
}

// Emanetteki jetonu alıcıya geçirir (tek seferlik: updateMany koşulu çift ödemeyi önler)
export async function releaseEscrow(id: string) {
  const r = await prisma.$transaction(async (tx) => {
    const { count } = await tx.contactRequest.updateMany({ where: { id, escrow: true }, data: { escrow: false, settlement: 'RELEASED' } });
    if (count !== 1) return null;
    const req = await tx.contactRequest.findUniqueOrThrow({ where: { id } });
    // Kesinti yok: bloke edilen jetonun tamamı alıcıya geçer (promosyon kısmı bozdurulamaz kazanç olur)
    const hold = await tx.walletEntry.findFirst({ where: { requestId: id, type: 'HOLD', userId: req.fromId } });
    const held = hold ? heldBuckets(hold) : { paid: req.price, promo: 0, earned: 0, earnedPromo: 0 };
    await credit(tx, req.toId, earningsFrom(held), 'EARN', { requestId: id, counterpartyId: req.fromId });
    return req;
  });
  if (!r) return;
  const payload = { id, status: 'ACCEPTED', settlement: 'RELEASED' };
  emitToUser(r.fromId, 'request:updated', payload);
  emitToUser(r.toId, 'request:updated', payload);
  emitToUser(r.toId, 'wallet:updated', {});
  // Faz 19: kazanç heyecanı — etkinlik bonusu ve kilometre taşları (ana işlemden ayrı)
  await applyEarningEventBonus(r.toId, r.price, `request:${id}`).catch(() => {});
  await checkEarningMilestones(r.toId).catch(() => {});
}

// Süresi dolan emaneti gönderene iade eder (alıcı yeterince cevap yazmadı)
export async function refundEscrow(id: string) {
  const r = await prisma.$transaction(async (tx) => {
    const { count } = await tx.contactRequest.updateMany({ where: { id, escrow: true }, data: { escrow: false, settlement: 'REFUNDED' } });
    if (count !== 1) return null;
    const req = await tx.contactRequest.findUniqueOrThrow({ where: { id } });
    const hold = await tx.walletEntry.findFirst({ where: { requestId: id, type: 'HOLD', userId: req.fromId } });
    await credit(tx, req.fromId, hold ? heldBuckets(hold) : { paid: req.price }, 'REFUND', { requestId: id });
    return req;
  });
  if (!r) return;
  const payload = { id, status: 'ACCEPTED', settlement: 'REFUNDED' };
  emitToUser(r.fromId, 'request:updated', payload);
  emitToUser(r.toId, 'request:updated', payload);
  emitToUser(r.fromId, 'wallet:updated', {});
}

export async function settleExpiredEscrows() {
  const due = await prisma.contactRequest.findMany({
    where: { escrow: true, escrowUntil: { lte: new Date() } },
    select: { id: true },
  });
  for (const { id } of due) await refundEscrow(id).catch(() => {});
}
