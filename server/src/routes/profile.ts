import type { Profile } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { currentSession, uid } from '../auth';
import {
  AVATAR_ACCESSORIES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_OUTFITS,
  AVATAR_SKINS,
  CARD_BACKGROUNDS,
  EDUCATION,
  HABIT,
  INTERESTS,
  LOOKING_FOR,
  MAX_INTERESTS,
  MAX_PROMPTS,
  PROMPTS,
  ROOM_FLOORS,
  ROOM_GRID_H,
  ROOM_GRID_W,
  ROOM_ITEMS,
  ROOM_MAX_ITEMS,
  ROOM_WALLPAPERS,
  THEMES,
  ZODIAC,
} from '../catalog';
import { ageOf } from '../age';
import { verifyPassword } from '../passwords';
import { photoUrls, removeProfilePhoto, storeProfilePhoto } from '../images';
import { config } from '../config';
import { HttpError, isBlockedEitherWay, orderedPair, prisma } from '../db';
import { roundCoord, roundedDistance } from '../geo';
import { isOnline } from '../realtime';
import { getBalance, getCashable } from '../wallet';
import { reviewNewPhoto } from '../moderation/detect';
import { requireNotRestricted, sanctionDto } from '../moderation/sanctions';
import { requestDeletion } from '../privacy/accounts';
import { consentState, legalUpdatesNeeded, requireConsent } from '../privacy/consents';
import { listSessions, revokeAllSessions, revokeSession } from '../sessions';

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
    photos: { id: string; path: string; position: number; hiddenAt?: Date | null }[];
  },
  viewer?: Pick<Profile, 'latitude' | 'longitude'> | null,
  opts: { owner?: boolean } = {},
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
    themeId: p.themeId,
    cardBackgroundId: p.cardBackgroundId,
    avatarSkinId: p.avatarSkinId,
    avatarHairStyle: p.avatarHairStyle,
    avatarHairColorId: p.avatarHairColorId,
    avatarOutfitId: p.avatarOutfitId,
    avatarAccessoryId: p.avatarAccessoryId,
    // İncelemedeki fotoğraflar başkalarına gösterilmez; sahibi "incelemede" etiketiyle görür
    photos: [...user.photos]
      .filter((ph) => opts.owner || !ph.hiddenAt)
      .sort((a, b) => a.position - b.position)
      .map((ph) => ({ id: ph.id, ...photoUrls(ph.path), ...(opts.owner && ph.hiddenAt ? { underReview: true } : {}) })),
  };
}

// "Şu an" rozeti: anlık bağlantı durumu, publicProfile()'a dahil değil (çoğu yerde gerekmiyor,
// sorgu maliyeti var) — sadece gösterileceği yerlerde (profil detayı, keşfet destesi) eklenir.
export async function withOnline<T extends { id: string }>(profile: T): Promise<T & { online: boolean }> {
  return { ...profile, online: await isOnline(profile.id) };
}
export async function withOnlineMany<T extends { id: string }>(profiles: T[]): Promise<(T & { online: boolean })[]> {
  return Promise.all(profiles.map(withOnline));
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
    profile: user.profile ? { ...publicProfile(user, null, { owner: true }), interestedIn: user.profile.interestedIn, birthDate: user.profile.birthDate } : null,
    balance: await getBalance(user.id),
    cashable: await getCashable(user.id),
    consents: consentState(user),
    // Değişen yasal metinler: uygulama yeniden onay ekranı gösterir
    legalUpdates: legalUpdatesNeeded(user),
    restrictedUntil: user.restrictedUntil && user.restrictedUntil > new Date() ? user.restrictedUntil : null,
    // Henüz gösterilmemiş son yaptırım (uyarı/kısıt): uygulama açılışta bildirir, itiraz seçeneği sunar
    pendingSanction: await prisma.sanction
      .findFirst({ where: { userId: user.id, seenAt: null, revokedAt: null }, orderBy: { createdAt: 'desc' }, include: { appeal: true } })
      .then((s) => (s ? sanctionDto(s) : null)),
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
// ios-voip: normal FCM değil, CallKit'i uyandıran PushKit jetonu (Faz 15 · yerel gelen arama ekranı).
profileRouter.post('/me/devices', async (req, res) => {
  const { token, platform } = z
    .object({ token: z.string().min(10).max(4096), platform: z.enum(['android', 'ios', 'web', 'ios-voip']) })
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

// Cihazlarım: açık oturumlar. Kullanıcı tanımadığı bir cihazı buradan çıkarabilir.
profileRouter.get('/me/sessions', async (req, res) => {
  res.json(await listSessions(uid(req), currentSession(req)));
});

profileRouter.delete('/me/sessions/:id', async (req, res) => {
  const session = await prisma.session.findFirst({ where: { id: req.params.id, userId: uid(req), revokedAt: null } });
  if (!session) throw new HttpError(404, 'not_found');
  await revokeSession(session.id, session.id === currentSession(req) ? 'logout' : 'user_revoked');
  res.json({ ok: true });
});

profileRouter.post('/me/sessions/revoke-others', async (req, res) => {
  await revokeAllSessions(uid(req), 'user_revoked', currentSession(req));
  res.json({ ok: true });
});

// Hesap silme (App Store zorunluluğu). Şifre ile onaylanır. Hesap hemen gizlenir ve oturumlar kapanır;
// bekleme süresi içinde giriş yapılırsa geri gelir, sonra kalıcı silinir (privacy/accounts.ts).
// Dahil olduğu bekleyen istekler kapatılır, bloke jetonlar gönderenlere iade edilir.
profileRouter.delete('/me', async (req, res) => {
  const { password } = z.object({ password: z.string() }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid(req) } });
  if (!(await verifyPassword(user.passwordHash, password)).ok) throw new HttpError(401, 'invalid_credentials');
  const deleteAfter = await requestDeletion(user.id);
  res.json({ ok: true, deleteAfter });
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
  themeId: z.enum(THEMES).or(z.literal('')).default(''),
  cardBackgroundId: z.enum(CARD_BACKGROUNDS).or(z.literal('')).default(''),
  avatarSkinId: z.enum(AVATAR_SKINS).or(z.literal('')).default(''),
  avatarHairStyle: z.enum(AVATAR_HAIR_STYLES).or(z.literal('')).default(''),
  avatarHairColorId: z.enum(AVATAR_HAIR_COLORS).or(z.literal('')).default(''),
  avatarOutfitId: z.enum(AVATAR_OUTFITS).or(z.literal('')).default(''),
  avatarAccessoryId: z.enum(AVATAR_ACCESSORIES).or(z.literal('')).default(''),
});

profileRouter.put('/me/profile', requireNotRestricted, async (req, res) => {
  const data = profileSchema.parse(req.body);
  if (ageOf(data.birthDate) < config.minAge) throw new HttpError(403, 'underage');
  const userId = uid(req);
  // Kimi görmek istediğin (cinsel yönelim) özel nitelikli veridir: açık rıza olmadan kaydedilmez
  await requireConsent(userId, 'special_category');
  await prisma.profile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  res.json({ ok: true });
});

profileRouter.put('/me/locale', async (req, res) => {
  const { locale } = z.object({ locale: z.enum(['tr', 'en']) }).parse(req.body);
  await prisma.user.update({ where: { id: uid(req) }, data: { locale } });
  res.json({ ok: true });
});

profileRouter.post('/me/photos', requireNotRestricted, upload.single('photo'), async (req, res) => {
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
  // Hemen yayında; şüpheliyse gizlenir ve moderasyon kuyruğuna düşer (sahibi "incelemede" görür)
  const underReview = await reviewNewPhoto(userId, photo.id, req.file.buffer).catch((e) => {
    console.error('[moderasyon] fotoğraf', e);
    return false;
  });
  res.status(201).json({ id: photo.id, ...photoUrls(photo.path), underReview });
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
  const profile = user && !user.bannedAt && !user.deletionRequestedAt && publicProfile(user, target === me ? null : viewer, { owner: target === me });
  if (!profile) throw new HttpError(404, 'not_found');
  res.json(target === me ? profile : await withOnline(profile));
});

// Faz 16: kendi oda (statik yerleşim, gerçek zamanlı gezinme yok). Izgara src/catalog.ts ROOM_GRID_*.
const roomItemSchema = z.object({
  itemId: z.enum(ROOM_ITEMS),
  x: z.number().int().min(0).max(ROOM_GRID_W - 1),
  y: z.number().int().min(0).max(ROOM_GRID_H - 1),
});
const roomSchema = z.object({
  wallpaperId: z.enum(ROOM_WALLPAPERS).or(z.literal('')).default(''),
  floorId: z.enum(ROOM_FLOORS).or(z.literal('')).default(''),
  items: z
    .array(roomItemSchema)
    .max(ROOM_MAX_ITEMS)
    .default([])
    .refine((items) => new Set(items.map((i) => `${i.x},${i.y}`)).size === items.length, 'duplicate_position'),
});
const roomDto = (p: Pick<Profile, 'roomWallpaperId' | 'roomFloorId' | 'roomItems'>) => ({
  wallpaperId: p.roomWallpaperId,
  floorId: p.roomFloorId,
  items: p.roomItems as { itemId: string; x: number; y: number }[],
});

profileRouter.get('/me/room', async (req, res) => {
  const p = await prisma.profile.findUniqueOrThrow({ where: { userId: uid(req) } });
  res.json(roomDto(p));
});

profileRouter.put('/me/room', requireNotRestricted, async (req, res) => {
  const data = roomSchema.parse(req.body);
  await prisma.profile.update({
    where: { userId: uid(req) },
    data: { roomWallpaperId: data.wallpaperId, roomFloorId: data.floorId, roomItems: data.items },
  });
  res.json({ ok: true });
});

// Ziyaret: sadece bağlantın olan (bir konuşmanız olan) kişilerin odasını görebilirsin, salt görüntüleme
profileRouter.get('/users/:id/room', async (req, res) => {
  const me = uid(req);
  const target = req.params.id;
  if (target !== me) {
    if (await isBlockedEitherWay(me, target)) throw new HttpError(404, 'not_found');
    const [userAId, userBId] = orderedPair(me, target);
    const conv = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
    if (!conv) throw new HttpError(403, 'not_connected');
  }
  const user = await prisma.user.findUnique({ where: { id: target }, include: { profile: true } });
  if (!user?.profile || user.bannedAt || user.deletionRequestedAt) throw new HttpError(404, 'not_found');
  res.json({ ...roomDto(user.profile), displayName: user.profile.displayName });
});
