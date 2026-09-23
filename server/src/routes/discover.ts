import { Router } from 'express';
import { z } from 'zod';
import { uid } from '../auth';
import { economy } from '../config';
import { HttpError, isBlockedEitherWay, orderedPair, prisma } from '../db';
import { distanceKm } from '../geo';
import { swipeLimiter } from '../limits';
import { notify } from '../notify';
import { emitToUser } from '../realtime';
import { addEntry, getBalance } from '../wallet';
import { publicProfile } from './profile';

export const discoverRouter = Router();

const yearsAgo = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
};

// Kaydırma kartları: daha önce kaydırılmamış, engel olmayan, cinsiyet tercihi karşılıklı uyan,
// yaş/mesafe filtresine giren kullanıcılar.
// Sıralama: seni süper beğenenler → öne çıkarılmış profiller → en yakınlar → en yeniler.
discoverRouter.get('/discover', async (req, res) => {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) }, include: { profile: true } });
  const my = me.profile;
  if (!my) throw new HttpError(400, 'profile_required');

  const candidates = await prisma.user.findMany({
    where: {
      id: { not: me.id },
      bannedAt: null,
      emailVerifiedAt: { not: null },
      photos: { some: {} },
      profile: {
        ...(my.interestedIn === 'everyone' ? {} : { gender: my.interestedIn }),
        interestedIn: { in: ['everyone', my.gender] },
        birthDate: { lte: yearsAgo(my.filterMinAge), gt: yearsAgo(my.filterMaxAge + 1) },
      },
      swipesReceived: { none: { fromId: me.id } },
      blocksGiven: { none: { toId: me.id } },
      blocksReceived: { none: { fromId: me.id } },
    },
    include: {
      profile: true,
      photos: true,
      swipesGiven: { where: { toId: me.id, direction: 'superlike' }, select: { id: true } },
    },
    take: 200,
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  const hasLoc = my.latitude != null && my.longitude != null;
  const scored = candidates
    .map((c) => {
      const p = c.profile!;
      const km = hasLoc && p.latitude != null && p.longitude != null
        ? distanceKm(my.latitude!, my.longitude!, p.latitude, p.longitude)
        : null;
      return { c, km, superLikedMe: c.swipesGiven.length > 0, boosted: !!c.boostedUntil && c.boostedUntil > now };
    })
    // Mesafe filtresi: konumu bilinmeyenler dışlanmaz (deste boşalmasın)
    .filter((x) => my.filterMaxKm === 0 || x.km === null || x.km <= my.filterMaxKm)
    .sort((a, b) =>
      Number(b.superLikedMe) - Number(a.superLikedMe) ||
      Number(b.boosted) - Number(a.boosted) ||
      (a.km ?? 1e9) - (b.km ?? 1e9),
    )
    .slice(0, 20);

  res.json(scored.map((x) => ({ ...publicProfile(x.c, my), superLikedMe: x.superLikedMe })));
});

discoverRouter.post('/swipes', swipeLimiter, async (req, res) => {
  const { toId, direction } = z
    .object({ toId: z.string(), direction: z.enum(['like', 'pass', 'superlike']) })
    .parse(req.body);
  const me = uid(req);
  if (toId === me) throw new HttpError(400, 'invalid_target');
  const target = await prisma.user.findUnique({ where: { id: toId }, select: { bannedAt: true } });
  if (!target || target.bannedAt || (await isBlockedEitherWay(me, toId))) throw new HttpError(404, 'not_found');

  await prisma.$transaction(async (tx) => {
    const existing = await tx.swipe.findUnique({ where: { fromId_toId: { fromId: me, toId } } });
    // Süper beğeni jetonla: aynı kişiye ikinci kez ücret alınmaz
    if (direction === 'superlike' && existing?.direction !== 'superlike') {
      if ((await getBalance(me, tx)) < economy.superLikePrice) throw new HttpError(402, 'insufficient_balance');
      await addEntry(tx, { userId: me, amount: -economy.superLikePrice, type: 'SPEND', note: 'superlike' });
    }
    await tx.swipe.upsert({
      where: { fromId_toId: { fromId: me, toId } },
      create: { fromId: me, toId, direction },
      update: { direction },
    });
  });

  if (direction === 'pass') return res.json({ match: false });

  const reverse = await prisma.swipe.findUnique({ where: { fromId_toId: { fromId: toId, toId: me } } });
  const mutual = reverse?.direction === 'like' || reverse?.direction === 'superlike';
  if (!mutual) {
    if (direction === 'superlike') {
      emitToUser(toId, 'superlike', { fromId: me });
      void notify(toId, 'superlike', me);
    }
    return res.json({ match: false });
  }

  // Karşılıklı beğeni: ücretsiz sohbet açılır
  const [userAId, userBId] = orderedPair(me, toId);
  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId, origin: 'MATCH' },
    update: {},
  });
  emitToUser(toId, 'match', { conversationId: conversation.id, userId: me });
  void notify(toId, 'match', me, undefined, { conversationId: conversation.id });
  res.json({ match: true, conversationId: conversation.id });
});
