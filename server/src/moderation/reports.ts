import { prisma } from '../db';
import { applySanction } from './sanctions';

// Şikayetler: önceliklendirme ve tekrarlayan şikayette otomatik kısıt.
// Öncelik 1 (acil): reşit olmayan, müstehcenlik · 2: dolandırıcılık, taciz · 3: diğer
export const REPORT_REASONS = ['fake_profile', 'inappropriate_content', 'harassment', 'scam', 'underage', 'other'] as const;

const PRIORITY: Record<string, number> = { underage: 1, inappropriate_content: 1, scam: 2, harassment: 2 };

// Son 7 günde bu kadar farklı kişi şikayet ederse inceleme beklenmeden 24 saat kısıt (moderatör kaldırabilir)
export const BURST_REPORTERS = 3;
const BURST_DAYS = 7;

export async function fileReport(input: { fromId: string; toId: string; reason: string; details?: string; priority?: number }) {
  const report = await prisma.report.create({
    data: {
      fromId: input.fromId,
      toId: input.toId,
      reason: input.reason,
      details: input.details ?? '',
      priority: input.priority ?? PRIORITY[input.reason] ?? 3,
    },
  });
  await checkReportBurst(input.toId).catch((e) => console.error('[moderasyon] şikayet kontrolü', e));
  return report;
}

async function checkReportBurst(userId: string) {
  const since = new Date(Date.now() - BURST_DAYS * 86_400_000);
  const reporters = await prisma.report.findMany({ where: { toId: userId, createdAt: { gt: since } }, distinct: ['fromId'], select: { fromId: true } });
  if (reporters.length < BURST_REPORTERS) return;
  // Aynı dönemde zaten otomatik kısıt verildiyse tekrar verilmez
  const already = await prisma.moderationFlag.findFirst({ where: { userId, kind: 'report_burst', createdAt: { gt: since } } });
  if (already) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { restrictedUntil: true, bannedAt: true } });
  if (!user || user.bannedAt) return;
  await prisma.moderationFlag.create({
    data: { userId, kind: 'report_burst', priority: 1, details: { reporters: reporters.length, days: BURST_DAYS } },
  });
  if (!user.restrictedUntil || user.restrictedUntil < new Date()) {
    await applySanction({
      userId,
      level: 'restrict_24h',
      reason: 'report_burst',
      note: 'Hesabın kısa sürede birden fazla kişi tarafından şikayet edildi; inceleme sürerken geçici olarak kısıtlandı.',
      source: 'auto',
      createdBy: 'system',
    });
  }
}
