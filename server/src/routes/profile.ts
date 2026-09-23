import type { Profile } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { uid } from '../auth';
import { EDUCATION, HABIT, INTERESTS, LOOKING_FOR, MAX_INTERESTS, MAX_PROMPTS, PROMPTS, ZODIAC } from '../catalog';
import { ageOf } from '../age';
import { photoUrls, removeProfilePhoto, storeProfilePhoto } from '../images';
import { privateStore } from '../storage';
import { config } from '../config';
import { HttpError, isBlockedEitherWay, prisma } from '../db';
import { roundCoord, roundedDistance } from '../geo';
import { getBalance, getCashable } from '../wallet';
import { closeAllPendingFor } from '../requestService';

export const profileRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  // Tür ön süzgeci; asıl kontrol images.ts'te dosyanın içeriğine bakılarak yapılır
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
});


// viewer verilirse kullanıcıya olan yaklaşık mesafe (km) de eklenir; tam konum asla dönmez
export function publicProfile(
  user: {
    id: string;
    verificationStatus: string;
    profile: Profile | null;
    photos: { id: string; path: string; position: number }[];
  },
  viewer?: Pick<Profile, 'latitude' | 'longitude'> | null,
) {
  const p = user.profile;
  if (!p) return null;
  return {
    id: user.id,
    verified: user.verificationStatus === 'approved',
    distanceKm: roundedDistance(viewer, p),
    displayName: p.displayName,
    age: ageOf(p.birthDate),
    gender: p.gender,
    bio: p.bio,
    city: p.city,
    country: p.country,
    interests: p.interests as string[],
    prompts: p.prompts as { id: string; answer: string }[],
    lookingFor: p.lookingFor,
    heightCm: p.heightCm,
    job: p.job,
    education: p.education,
    zodiac: p.zodiac,
    smoking: p.smoking,
    drinking: p.drinking,
    photos: [...user.photos].sort((a, b) => a.position - b.position).map((ph) => ({ id: ph.id, ...photoUrls(ph.path) })),
  };
}

profileRouter.get('/me', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: uid(req) },
    include: { profile: true, photos: true },
  });
  res.json({
    id: user.id,
    email: user.email,
    locale: user.locale,
    emailVerified: user.emailVerifiedAt !== null,
    verificationStatus: user.verificationStatus,
    verificationPose: user.verificationPose,
    boostedUntil: user.boostedUntil && user.boostedUntil > new Date() ? user.boostedUntil : null,
    likesUnlockedUntil: user.likesUnlockedUntil && user.likesUnlockedUntil > new Date() ? user.likesUnlockedUntil : null,
    hasLocation: user.profile?.latitude != null,
    filters: user.profile
      ? { minAge: user.profile.filterMinAge, maxAge: user.profile.filterMaxAge, maxKm: user.profile.filterMaxKm }
      : null,
    profile: user.profile ? { ...publicProfile(user), interestedIn: user.profile.interestedIn, birthDate: user.profile.birthDate } : null,
    balance: await getBalance(user.id),
    cashable: await getCashable(user.id),
  });
});

// Konum: ~1 km'ye yuvarlanarak saklanır
profileRouter.put('/me/location', async (req, res) => {
  const { latitude, longitude } = z
    .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
    .parse(req.body);
  await prisma.profile.update({
    where: { userId: uid(req) },
    data: { latitude: roundCoord(latitude), longitude: roundCoord(longitude), locationAt: new Date() },
  });
  res.json({ ok: true });
});

profileRouter.put('/me/filters', async (req, res) => {
  const f = z
    .object({
      minAge: z.number().int().min(18).max(99),
      maxAge: z.number().int().min(18).max(99),
      maxKm: z.number().int().min(0).max(500), // 0 = sınırsız
    })
    .refine((v) => v.minAge <= v.maxAge, 'invalid_age_range')
    .parse(req.body);
  await prisma.profile.update({
    where: { userId: uid(req) },
    data: { filterMinAge: f.minAge, filterMaxAge: f.maxAge, filterMaxKm: f.maxKm },
  });
  res.json({ ok: true });
});

// Push bildirim cihazı kaydı (FCM jetonu). Aynı jeton başka hesaba geçerse sahibi güncellenir.
profileRouter.post('/me/devices', async (req, res) => {
  const { token, platform } = z
    .object({ token: z.string().min(10).max(4096), platform: z.enum(['android', 'ios', 'web']) })
    .parse(req.body);
  const userId = uid(req);
  await prisma.device.upsert({ where: { token }, create: { token, platform, userId }, update: { userId, platform } });
  res.json({ ok: true });
});

profileRouter.delete('/me/devices', async (req, res) => {
  const { token } = z.object({ token: z.string() }).parse(req.body);
  await prisma.device.deleteMany({ where: { token, userId: uid(req) } });
  res.json({ ok: true });
});

// Hesap silme (App Store zorunluluğu). Şifre ile onaylanır; geri alınamaz.
// Dahil olduğu bekleyen istekler kapatılır, bloke jetonlar gönderenlere iade edilir.
profileRouter.delete('/me', async (req, res) => {
  const { password } = z.object({ password: z.string() }).parse(req.body);
  const userId = uid(req);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { photos: true, verifications: true },
  });
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'invalid_credentials');

  // Bekleyen para çekme talebi varken hesap silinemez (önce iptal edilmeli ya da sonuçlanmalı)
  if (await prisma.payout.count({ where: { userId, status: 'PENDING' } })) throw new HttpError(409, 'payout_pending');

  await closeAllPendingFor(userId);

  await prisma.user.delete({ where: { id: userId } });
  for (const p of user.photos) await removeProfilePhoto(p.path);
  for (const v of user.verifications) await privateStore.remove(v.selfiePath);
  res.json({ ok: true });
});

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(30),
  birthDate: z.coerce.date(),
  gender: z.enum(['male', 'female', 'other']),
  interestedIn: z.enum(['male', 'female', 'everyone']),
  bio: z.string().max(500).default(''),
  city: z.string().max(60).default(''),
  country: z.string().max(60).default(''),
  interests: z
    .array(z.enum(INTERESTS))
    .max(MAX_INTERESTS)
    .default([])
    .transform((a) => [...new Set(a)]),
  prompts: z
    .array(z.object({ id: z.enum(PROMPTS), answer: z.string().trim().min(1).max(200) }))
    .max(MAX_PROMPTS)
    .default([])
    .refine((a) => new Set(a.map((p) => p.id)).size === a.length, 'duplicate_prompt'),
  lookingFor: z.enum(LOOKING_FOR).or(z.literal('')).default(''),
  heightCm: z.number().int().min(120).max(230).nullable().default(null),
  job: z.string().trim().max(60).default(''),
  education: z.enum(EDUCATION).or(z.literal('')).default(''),
  zodiac: z.enum(ZODIAC).or(z.literal('')).default(''),
  smoking: z.enum(HABIT).or(z.literal('')).default(''),
  drinking: z.enum(HABIT).or(z.literal('')).default(''),
});

profileRouter.put('/me/profile', async (req, res) => {
  const data = profileSchema.parse(req.body);
  if (ageOf(data.birthDate) < config.minAge) throw new HttpError(403, 'underage');
  const userId = uid(req);
  await prisma.profile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  res.json({ ok: true });
});

profileRouter.put('/me/locale', async (req, res) => {
  const { locale } = z.object({ locale: z.enum(['tr', 'en']) }).parse(req.body);
  await prisma.user.update({ where: { id: uid(req) }, data: { locale } });
  res.json({ ok: true });
});

profileRouter.post('/me/photos', upload.single('photo'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'invalid_image');
  const userId = uid(req);
  const count = await prisma.photo.count({ where: { userId } });
  if (count >= config.maxPhotos) throw new HttpError(400, 'too_many_photos');
  // Yeniden kodlanır: konum/cihaz üst verisi silinir, 3 boy üretilir
  const base = await storeProfilePhoto(req.file.buffer);
  const last = await prisma.photo.findFirst({ where: { userId }, orderBy: { position: 'desc' } });
  const photo = await prisma.photo.create({
    data: { userId, path: base, position: (last?.position ?? -1) + 1 },
  });
  res.status(201).json({ id: photo.id, ...photoUrls(photo.path) });
});

// Fotoğraf sırası: ilk sıradaki kapak fotoğrafı olur
profileRouter.put('/me/photos/order', async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string()).max(config.maxPhotos) }).parse(req.body);
  const userId = uid(req);
  const owned = await prisma.photo.findMany({ where: { userId }, select: { id: true } });
  const ownedIds = new Set(owned.map((p) => p.id));
  if (ids.length !== ownedIds.size || !ids.every((id) => ownedIds.has(id))) throw new HttpError(400, 'invalid_order');
  await prisma.$transaction(ids.map((id, position) => prisma.photo.update({ where: { id }, data: { position } })));
  res.json({ ok: true });
});

profileRouter.delete('/me/photos/:id', async (req, res) => {
  const photo = await prisma.photo.findFirst({ where: { id: req.params.id, userId: uid(req) } });
  if (!photo) throw new HttpError(404, 'not_found');
  await prisma.photo.delete({ where: { id: photo.id } });
  await removeProfilePhoto(photo.path);
  res.json({ ok: true });
});

profileRouter.get('/users/:id', async (req, res) => {
  const me = uid(req);
  const target = req.params.id;
  if (target !== me && (await isBlockedEitherWay(me, target))) throw new HttpError(404, 'not_found');
  const [user, viewer] = await Promise.all([
    prisma.user.findUnique({ where: { id: target }, include: { profile: true, photos: true } }),
    prisma.profile.findUnique({ where: { userId: me }, select: { latitude: true, longitude: true } }),
  ]);
  const profile = user && !user.bannedAt && publicProfile(user, target === me ? null : viewer);
  if (!profile) throw new HttpError(404, 'not_found');
  res.json(profile);
});
