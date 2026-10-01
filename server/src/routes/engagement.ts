import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { prisma } from '../db';
import { activeEarningEvent, eventDto } from '../events';
import { getFinance } from '../finance/settings';
import { photoUrls } from '../images';

// Faz 19: kazanç heyecanı — kazananlar sıralaması, canlı aktivite göstergesi, aktif etkinlik.
// Hepsi var olan tablolardan (WalletEntry, Call, Swipe) okunur; yeni veri saklamaz.
export const engagementRouter = Router();

const DAY = 86_400_000;

// ---------- Kazananlar sıralaması
// İsteğe bağlı katılım: sadece Profile.leaderboardOptIn=true olan kullanıcılar görünür.
engagementRouter.get('/leaderboard', async (req, res) => {
  const { period } = z.object({ period: z.enum(['week', 'month']).default('week') }).parse(req.query);
  const since = new Date(Date.now() - (period === 'week' ? 7 : 30) * DAY);
  const finance = await getFinance();

  // Katılımı kapalı veya hesabı silinen kullanıcıları ayıklamadan önce biraz daha geniş çek
  const sums = await prisma.walletEntry.groupBy({
    by: ['userId'],
    where: { type: 'EARN', amount: { gt: 0 }, createdAt: { gte: since } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 100,
  });
  if (sums.length === 0) return res.json({ period, entries: [], you: null });

  const profiles = await prisma.profile.findMany({
    where: { userId: { in: sums.map((s) => s.userId) }, leaderboardOptIn: true },
    select: { userId: true, displayName: true, user: { select: { photos: { orderBy: { position: 'asc' }, take: 1 } } } },
  });
  const byId = new Map(profiles.map((p) => [p.userId, p]));

  const entries = sums
    .map((s) => {
      const p = byId.get(s.userId);
      return p ? { p, coins: s._sum.amount ?? 0 } : null;
    })
    .filter((x): x is { p: NonNullable<ReturnType<typeof byId.get>>; coins: number } => x != null)
    .slice(0, 20)
    .map(({ p, coins }, i) => {
      const photo = p.user.photos[0];
      return {
        rank: i + 1,
        userId: p.userId,
        displayName: p.displayName,
        approxUsd: Math.round(coins * finance.cashoutUsdPerCoin),
        photo: photo ? photoUrls(photo.path) : null,
      };
    });

  const myId = uid(req);
  const myIndex = sums.findIndex((s) => s.userId === myId);
  const myOptedIn = (await prisma.profile.findUnique({ where: { userId: myId }, select: { leaderboardOptIn: true } }))?.leaderboardOptIn ?? false;
  const you =
    myIndex === -1
      ? null
      : { rank: myIndex + 1, optedIn: myOptedIn, approxUsd: Math.round((sums[myIndex]._sum.amount ?? 0) * finance.cashoutUsdPerCoin) };

  res.json({ period, entries, you });
});

engagementRouter.put('/me/leaderboard', async (req, res) => {
  const { optIn } = z.object({ optIn: z.boolean() }).parse(req.body);
  await prisma.profile.update({ where: { userId: uid(req) }, data: { leaderboardOptIn: optIn } });
  res.json({ optIn });
});

// ---------- Canlı aktivite göstergesi
engagementRouter.get('/activity', async (_req, res) => {
  const since = new Date(Date.now() - 5 * 60_000);
  const [activeCalls, recentMatches] = await Promise.all([
    prisma.call.count({ where: { status: 'ACTIVE' } }),
    prisma.conversation.count({ where: { origin: 'MATCH', createdAt: { gte: since } } }),
  ]);
  res.json({ activeCalls, recentMatches });
});

// ---------- Aktif kazanç etkinliği (banner için)
engagementRouter.get('/events/active', async (_req, res) => {
  const e = await activeEarningEvent();
  res.json(e ? eventDto(e) : null);
});
