import { Prisma } from '@prisma/client';
import { prisma } from './db';

// Faz 16: gizlilik dostu kullanım hunisi. Kendi sunucumuzda, sadece "analytics" rızası verilmiş
// kullanıcılar için; her aşamadan kullanıcı başına en fazla bir kayıt (upsert ile idempotent).
export const FUNNEL_STAGES = ['REGISTERED', 'MATCHED', 'FIRST_MESSAGE', 'FIRST_PURCHASE'] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

// Çağıran taraf best-effort kullanır (ana işlemi bloklamaz/başarısız etmez): `.catch(() => {})`.
export async function recordFunnelStage(userId: string, stage: FunnelStage, tx: Prisma.TransactionClient = prisma) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { consentAnalyticsAt: true } });
  if (!user?.consentAnalyticsAt) return; // rıza yoksa hiçbir şey yazılmaz
  await tx.analyticsEvent.upsert({
    where: { userId_kind: { userId, kind: stage } },
    create: { userId, kind: stage },
    update: {},
  });
}

// Rıza yeni verildiğinde: o ana kadar zaten ulaşılmış aşamaları bir kerelik işaretler. Yeni bir
// davranışsal izleme değil — uygulamanın zaten işlevi için sakladığı verinin (hesap doğrulandı mı,
// bir eşleşme/mesaj/satın alma var mı) o an itibarıyla bir özeti.
export async function backfillFunnelStages(userId: string) {
  const [user, matchCount, messageCount, purchaseCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } }),
    prisma.conversation.count({ where: { OR: [{ userAId: userId }, { userBId: userId }], origin: 'MATCH' } }),
    prisma.message.count({ where: { senderId: userId } }),
    prisma.purchase.count({ where: { userId } }),
  ]);
  if (user?.emailVerifiedAt) await recordFunnelStage(userId, 'REGISTERED');
  if (matchCount > 0) await recordFunnelStage(userId, 'MATCHED');
  if (messageCount > 0) await recordFunnelStage(userId, 'FIRST_MESSAGE');
  if (purchaseCount > 0) await recordFunnelStage(userId, 'FIRST_PURCHASE');
}

// Panel: her aşamaya ulaşan kullanıcı sayısı (kullanıcı başına tek kayıt olduğundan satır sayısı ==
// kullanıcı sayısı) + rıza vermiş toplam kullanıcı.
export async function funnelReport() {
  const counts = await prisma.analyticsEvent.groupBy({ by: ['kind'], _count: { _all: true } });
  const byKind = Object.fromEntries(counts.map((c) => [c.kind, c._count._all]));
  const consented = await prisma.user.count({ where: { consentAnalyticsAt: { not: null } } });
  return { consented, funnel: FUNNEL_STAGES.map((stage) => ({ stage, count: byKind[stage] ?? 0 })) };
}
