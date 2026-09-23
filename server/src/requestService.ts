import { HttpError, prisma } from './db';
import { emitToUser } from './realtime';
import { addEntry } from './wallet';

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
    await addEntry(tx, { userId: r.fromId, amount: r.price, type: 'REFUND', requestId: id });
    return r;
  });
  emitToUser(request.fromId, 'request:updated', { id, status });
  emitToUser(request.toId, 'request:updated', { id, status });
}

// Bir kullanıcının dahil olduğu tüm bekleyen istekleri kapatır (yasaklama/hesap silme).
export async function closeAllPendingFor(userId: string) {
  const pending = await prisma.contactRequest.findMany({
    where: { status: 'PENDING', OR: [{ fromId: userId }, { toId: userId }] },
    select: { id: true },
  });
  for (const { id } of pending) await closeRequest(id, 'CANCELLED').catch(() => {});
}
