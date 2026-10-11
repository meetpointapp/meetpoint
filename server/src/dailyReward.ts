import { economy } from './config';
import { HttpError, prisma } from './db';
import { localDateStr } from './streak';
import { credit, lockWallet } from './wallet';

// Faz 20: günlük giriş ödülü. Küçük tutulur (jeton satışından kazanıyoruz): 7 günlük döngü + seri
// eşiklerinde tek seferlik küçük bonus. Hepsi "promo" kovasına girer: harcanabilir ama bozdurulamaz,
// yani platform nakit zararı yazmaz. Gün, kullanıcının yerel günüdür (src/streak.ts) — seri bir gün
// atlanırsa 1'e döner ve döngü baştan başlar.

const cfg = economy.dailyReward;

// Serinin N'inci gününün günlük ödülü (7 günlük döngü)
export const cycleCoins = (streak: number) => cfg.cycle[(Math.max(1, streak) - 1) % cfg.cycle.length];
// Seri tam bu güne ulaşınca verilen tek seferlik bonus (yoksa 0)
export const streakBonus = (streak: number) => cfg.streakBonuses[String(streak)] ?? 0;
export const rewardFor = (streak: number) => cycleCoins(streak) + streakBonus(streak);

export async function dailyRewardState(userId: string, month?: string, now = new Date()) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { currentStreak: true, longestStreak: true, lastStreakDate: true, tzOffsetMin: true },
  });
  const today = localDateStr(now, user.tzOffsetMin);
  // Seri bugün işlenmediyse (bugün hiç açılmadıysa) ödül bugün için de yarın için değildir
  const activeToday = user.lastStreakDate === today;
  const streak = activeToday ? user.currentStreak : 0;
  const claimedToday = !!(await prisma.dailyClaim.findUnique({ where: { userId_day: { userId, day: today } }, select: { id: true } }));
  const ym = /^\d{4}-\d{2}$/.test(month ?? '') ? (month as string) : today.slice(0, 7);
  const claims = await prisma.dailyClaim.findMany({
    where: { userId, day: { startsWith: ym } },
    select: { day: true, coins: true },
  });
  const nextBonusStreak = Object.keys(cfg.streakBonuses)
    .map(Number)
    .sort((a, b) => a - b)
    .find((s) => s > streak);
  return {
    today,
    streak,
    longest: user.longestStreak,
    claimedToday,
    claimable: activeToday && !claimedToday,
    // Bugün alınabilecek (ya da alınan) tutar
    todayCoins: rewardFor(Math.max(streak, 1)),
    cycle: cfg.cycle.map((coins, i) => ({ day: i + 1, coins })),
    // Döngüdeki konum (1-7): alınmışsa bugün alınan gün, alınmamışsa bugün alınacak gün
    cycleDay: ((Math.max(streak, 1) - 1) % cfg.cycle.length) + 1,
    nextBonus: nextBonusStreak ? { streak: nextBonusStreak, coins: cfg.streakBonuses[String(nextBonusStreak)] } : null,
    month: ym,
    claimedDays: claims.map((c) => Number(c.day.slice(8, 10))),
    monthCoins: claims.reduce((s, c) => s + c.coins, 0),
  };
}

export async function claimDailyReward(userId: string, now = new Date()) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { currentStreak: true, lastStreakDate: true, tzOffsetMin: true },
  });
  const today = localDateStr(now, user.tzOffsetMin);
  // Seri bugün işlenmemişse (GET /me bugün çağrılmadı) ödül verilmez: uygulama açılışta /me çeker
  if (user.lastStreakDate !== today) throw new HttpError(409, 'daily_not_active');
  const streak = Math.max(1, user.currentStreak);
  const base = cycleCoins(streak);
  const bonus = streakBonus(streak);
  const total = base + bonus;
  try {
    await prisma.$transaction(async (tx) => {
      await lockWallet(tx, userId);
      // Tekil (userId, day) kısıtı çift alımı engeller; çakışırsa işlem geri alınır, jeton verilmez
      await tx.dailyClaim.create({ data: { userId, day: today, streakDay: streak, coins: total, bonusCoins: bonus } });
      await credit(tx, userId, { promo: total }, 'GRANT', { note: `daily:${today}` });
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw new HttpError(409, 'daily_already_claimed');
    throw e;
  }
  return { coins: total, baseCoins: base, bonusCoins: bonus, ...(await dailyRewardState(userId, undefined, now)) };
}
