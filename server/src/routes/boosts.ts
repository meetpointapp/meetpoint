import { Router } from 'express';
import { uid } from '../auth';
import { economy } from '../config';
import { HttpError, prisma } from '../db';
import { addEntry, getBalance } from '../wallet';
import { publicProfile } from './profile';

// Jetonla alınan özellikler: öne çıkarma ve "seni beğenenler". Jetonlar kimseye geçmez (SPEND).
export const boostsRouter = Router();

// Öne çıkar: belirli süre boyunca keşfette üst sıralarda görün
boostsRouter.post('/boost', async (req, res) => {
  const userId = uid(req);
  const boostedUntil = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.boostedUntil && user.boostedUntil > new Date()) throw new HttpError(409, 'already_boosted');
    if ((await getBalance(userId, tx)) < economy.boostPrice) throw new HttpError(402, 'insufficient_balance');
    await addEntry(tx, { userId, amount: -economy.boostPrice, type: 'SPEND', note: 'boost' });
    const until = new Date(Date.now() + economy.boostMinutes * 60_000);
    await tx.user.update({ where: { id: userId }, data: { boostedUntil: until } });
    return until;
  });
  res.json({ boostedUntil });
});

// Seni beğenenler: kilitliyken sadece sayı döner, açıkken profiller
boostsRouter.get('/likes', async (req, res) => {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) }, include: { profile: true } });
  const where = {
    toId: me.id,
    direction: { in: ['like', 'superlike'] },
    from: {
      bannedAt: null,
      profile: { isNot: null },
      swipesReceived: { none: { fromId: me.id } },
      blocksGiven: { none: { toId: me.id } },
      blocksReceived: { none: { fromId: me.id } },
    },
  };
  const count = await prisma.swipe.count({ where });
  const unlocked = !!me.likesUnlockedUntil && me.likesUnlockedUntil > new Date();
  if (!unlocked) return res.json({ unlocked: false, count, users: [] });

  const likes = await prisma.swipe.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { from: { include: { profile: true, photos: true } } },
  });
  res.json({
    unlocked: true,
    unlockedUntil: me.likesUnlockedUntil,
    count,
    users: likes.map((s) => ({ ...publicProfile(s.from, me.profile), superLikedMe: s.direction === 'superlike' })),
  });
});

boostsRouter.post('/likes/unlock', async (req, res) => {
  const userId = uid(req);
  const until = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.likesUnlockedUntil && user.likesUnlockedUntil > new Date()) return user.likesUnlockedUntil;
    if ((await getBalance(userId, tx)) < economy.likesUnlockPrice) throw new HttpError(402, 'insufficient_balance');
    await addEntry(tx, { userId, amount: -economy.likesUnlockPrice, type: 'SPEND', note: 'likes_unlock' });
    const next = new Date(Date.now() + economy.likesUnlockHours * 3600_000);
    await tx.user.update({ where: { id: userId }, data: { likesUnlockedUntil: next } });
    return next;
  });
  res.json({ unlockedUntil: until });
});
