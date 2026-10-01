import { prisma } from './db';
import { credit } from './wallet';

// Faz 19: zaman sınırlı kazanç etkinlikleri ("Bu hafta sonu 2x kazanç"). Panelden (Finans) yönetilir.
// Çarpan, normal EARN kredisinin üzerine bir BONUS olarak eklenir — platform karşılıyor, karşı
// taraftan ekstra jeton alınmaz (ledger tutarlılığı bozulmaz). Bonus "earnedPromo" kovasına girer:
// harcanabilir ama bozdurulamaz (diğer promosyon jetonlarıyla aynı kural).

export async function activeEarningEvent(now = new Date()) {
  return prisma.earningEvent.findFirst({ where: { startAt: { lte: now }, endAt: { gt: now } }, orderBy: { multiplier: 'desc' } });
}

// Bir EARN kredisinin ardından çağrılır: aktif etkinlik varsa bonus jetonu ekler.
export async function applyEarningEventBonus(userId: string, baseEarnedCoins: number, note: string) {
  if (baseEarnedCoins <= 0) return;
  const event = await activeEarningEvent();
  if (!event) return;
  const bonus = Math.round(baseEarnedCoins * (event.multiplier - 1));
  if (bonus <= 0) return;
  await prisma.$transaction((tx) => credit(tx, userId, { earnedPromo: bonus }, 'EARN_BONUS', { note: `${note}:event:${event.id}` }));
}

export function eventDto(e: { id: string; title: string; multiplier: number; startAt: Date; endAt: Date }) {
  return { id: e.id, title: e.title, multiplier: e.multiplier, startAt: e.startAt, endAt: e.endAt };
}
