import { prisma } from './db';
import { notify } from './notify';

// Faz 17: günlük giriş serisi. Kullanıcının yerel gününe göre hesaplanır (tzOffsetMin — sessiz
// saatlerde de kullanılan aynı alan, cihazdan gelir), UTC takvim günü değil: gerçekten "bugün
// açtın mı" sorusuna karşılık gelsin. Sunucu tek bir saat dilimi varsaymaz.
export function localDateStr(now: Date, tzOffsetMin: number): string {
  return new Date(now.getTime() + tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

// Her GET /me çağrısında (uygulama her açılışta bunu çeker) çalışır: aynı yerel günde tekrar
// çağrılırsa hiçbir şey değişmez (idempotent). Bir gün atlanırsa seri 1'e sıfırlanır.
export async function touchStreak(userId: string, tzOffsetMin: number, now = new Date()) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { currentStreak: true, longestStreak: true, lastStreakDate: true },
  });
  const today = localDateStr(now, tzOffsetMin);
  if (user.lastStreakDate === today) return { current: user.currentStreak, longest: user.longestStreak };
  const yesterday = localDateStr(new Date(now.getTime() - 86_400_000), tzOffsetMin);
  const current = user.lastStreakDate === yesterday ? user.currentStreak + 1 : 1;
  const longest = Math.max(user.longestStreak, current);
  await prisma.user.update({ where: { id: userId }, data: { currentStreak: current, longestStreak: longest, lastStreakDate: today } });
  return { current, longest };
}

// Zamanlayıcıdan (scheduler.ts) periyodik çağrılır: aktif bir serisi olup bugün (kendi yerel
// gününde) henüz açmamış kullanıcılara, yerel saatleri 20:00'i geçince (gün bitmeden bir şans
// daha) ve aynı gün ikinci kez göndermeden "serini kaybetme" bildirimi yollar.
export async function sendStreakReminders(now = new Date()) {
  const candidates = await prisma.user.findMany({
    where: { currentStreak: { gt: 0 }, bannedAt: null, deletionRequestedAt: null },
    select: { id: true, tzOffsetMin: true, lastStreakDate: true, streakReminderDate: true, currentStreak: true },
  });
  for (const u of candidates) {
    const today = localDateStr(now, u.tzOffsetMin);
    if (u.lastStreakDate === today || u.streakReminderDate === today) continue;
    const localMinutes = (((now.getUTCHours() * 60 + now.getUTCMinutes() + u.tzOffsetMin) % 1440) + 1440) % 1440;
    if (localMinutes < 20 * 60) continue;
    await prisma.user.update({ where: { id: u.id }, data: { streakReminderDate: today } });
    void notify(u.id, 'streak_risk', u.id, String(u.currentStreak));
  }
}
