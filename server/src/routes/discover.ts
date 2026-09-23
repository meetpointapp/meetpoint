import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { birthdayForAge } from '../age';
import { uid } from '../auth';
import { economy } from '../config';
import { HttpError, isBlockedEitherWay, orderedPair, prisma } from '../db';
import { swipeLimiter } from '../limits';
import { notify } from '../notify';
import { emitToUser } from '../realtime';
import { debit, lockWallet } from '../wallet';
import { publicProfile } from './profile';

export const discoverRouter = Router();


// Kaydırma kartları: daha önce kaydırılmamış, engel olmayan, cinsiyet tercihi karşılıklı uyan,
// yaş/mesafe filtresine giren kullanıcılar.
// Sıralama: seni süper beğenenler → öne çıkarılmış profiller → en yakınlar → en yeniler.
// Süzme ve sıralamanın tamamı veritabanında yapılır, sadece gösterilecek 20 kart okunur
// (kullanıcı sayısı büyüdükçe eski süper beğenenler veya yakındakiler kaybolmasın).
const DECK_SIZE = 20;
const KM_PER_DEG_LAT = 111.32;

discoverRouter.get('/discover', async (req, res) => {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) }, include: { profile: true } });
  const my = me.profile;
  if (!my) throw new HttpError(400, 'profile_required');

  const hasLoc = my.latitude != null && my.longitude != null;
  const lat = my.latitude ?? 0;
  const lng = my.longitude ?? 0;
  const maxKm = hasLoc ? my.filterMaxKm : 0;
  // Kuş uçuşu mesafe (Haversine, km); konumu bilinmeyenlerde NULL
  const km = hasLoc
    ? Prisma.sql`CASE WHEN p."latitude" IS NULL OR p."longitude" IS NULL THEN NULL ELSE
        2 * 6371 * asin(sqrt(
          power(sin(radians(p."latitude" - ${lat}) / 2), 2) +
          cos(radians(${lat})) * cos(radians(p."latitude")) * power(sin(radians(p."longitude" - ${lng}) / 2), 2)
        )) END`
    : Prisma.sql`NULL::float8`;
  // Mesafe sınırı: önce indeksle kaba kutu, sonra kesin mesafe. Konumu bilinmeyenler dışlanmaz.
  const dLat = maxKm / KM_PER_DEG_LAT;
  const dLng = maxKm / (KM_PER_DEG_LAT * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  const distanceFilter =
    maxKm > 0
      ? Prisma.sql`AND (p."latitude" IS NULL OR (
          p."latitude" BETWEEN ${lat - dLat} AND ${lat + dLat} AND p."longitude" BETWEEN ${lng - dLng} AND ${lng + dLng}
          AND ${km} <= ${maxKm}))`
      : Prisma.empty;
  const genderFilter = my.interestedIn === 'everyone' ? Prisma.empty : Prisma.sql`AND p."gender" = ${my.interestedIn}`;

  const rows = await prisma.$queryRaw<{ id: string; superLikedMe: boolean }[]>`
    SELECT u."id",
      EXISTS (SELECT 1 FROM "Swipe" s WHERE s."fromId" = u."id" AND s."toId" = ${me.id} AND s."direction" = 'superlike') AS "superLikedMe",
      (u."boostedUntil" IS NOT NULL AND u."boostedUntil" > NOW() AT TIME ZONE 'UTC') AS "boosted",
      ${km} AS "km"
    FROM "User" u
    JOIN "Profile" p ON p."userId" = u."id"
    WHERE u."id" <> ${me.id}
      AND u."bannedAt" IS NULL
      AND u."emailVerifiedAt" IS NOT NULL
      AND EXISTS (SELECT 1 FROM "Photo" ph WHERE ph."userId" = u."id")
      ${genderFilter}
      AND p."interestedIn" IN ('everyone', ${my.gender})
      AND p."birthDate" <= ${birthdayForAge(my.filterMinAge)} AND p."birthDate" > ${birthdayForAge(my.filterMaxAge + 1)}
      AND NOT EXISTS (SELECT 1 FROM "Swipe" s WHERE s."fromId" = ${me.id} AND s."toId" = u."id")
      AND NOT EXISTS (SELECT 1 FROM "Block" b WHERE (b."fromId" = u."id" AND b."toId" = ${me.id}) OR (b."fromId" = ${me.id} AND b."toId" = u."id"))
      ${distanceFilter}
    ORDER BY "superLikedMe" DESC, "boosted" DESC, "km" ASC NULLS LAST, u."createdAt" DESC
    LIMIT ${DECK_SIZE}`;

  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.id) } }, include: { profile: true, photos: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  res.json(
    rows
      .filter((r) => byId.has(r.id))
      .map((r) => ({ ...publicProfile(byId.get(r.id)!, my), superLikedMe: r.superLikedMe })),
  );
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
    // Süper beğenide önce cüzdan kilitlenir: eşzamanlı iki istek çift ücret alamaz
    if (direction === 'superlike') await lockWallet(tx, me);
    const existing = await tx.swipe.findUnique({ where: { fromId_toId: { fromId: me, toId } } });
    // Süper beğeni jetonla: aynı kişiye ikinci kez ücret alınmaz
    if (direction === 'superlike' && existing?.direction !== 'superlike') {
      await debit(tx, me, economy.superLikePrice, 'SPEND', { note: 'superlike' });
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
