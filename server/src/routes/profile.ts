import type { Profile } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { currentSession, uid } from '../auth';
import {
  CARD_BACKGROUNDS,
  EDUCATION,
  HABIT,
  INTERESTS,
  LOOKING_FOR,
  MAX_INTERESTS,
  MAX_MUSIC_GENRES,
  MUSIC_GENRES,
  MAX_PROMPTS,
  MOOD_TTL_MS,
  MOODS,
  PROMPTS,
  STORE_BADGES,
  STORE_CHAT_BACKGROUNDS,
  STORE_CHAT_BUBBLES,
  STORE_FRAMES,
  STORE_THEMES,
  THEMES,
  ZODIAC,
} from '../catalog';
import { assertOwned, ownedItemIds } from './store';
import { computeArchetype, VIBE_QUESTIONS } from '../vibe';
import { ageOf } from '../age';
import { verifyPassword } from '../passwords';
import { photoUrls, removeProfilePhoto, storeProfilePhoto } from '../images';
import { config } from '../config';
import { HttpError, isBlockedEitherWay, prisma } from '../db';
import { roundCoord, roundedDistance } from '../geo';
import { isOnline } from '../realtime';
import { getBalance, getCashable } from '../wallet';
import { reviewNewPhoto } from '../moderation/detect';
import { requireNotRestricted, sanctionDto } from '../moderation/sanctions';
import { requestDeletion } from '../privacy/accounts';
import { sendStreakReminders, touchStreak } from '../streak';
import { ALL_MILESTONES, checkProfileComplete, nextStepHint, tracksState, unlockMilestone } from '../achievements';
import { referralStats } from '../referral';
import { weeklyDigest } from '../weeklyDigest';
import { consentState, legalUpdatesNeeded, requireConsent } from '../privacy/consents';
import { listSessions, revokeAllSessions, revokeSession } from '../sessions';

export const profileRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  // Tür ön süzgeci; asıl kontrol images.ts'te dosyanın içeriğine bakılarak yapılır
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
});


// Faz 16: günlük ruh hali. 24 saat sonra "biter" — burada okuma anında hesaplanır, ayrı bir
// temizlik işi yok. moodExpiresAt sadece sahibine döner (başkası sadece geçerli moodId'yi görür).
function activeMood(p: Pick<Profile, 'moodId' | 'moodSetAt'>): { moodId: string; moodExpiresAt: Date | null } {
  if (!p.moodId || !p.moodSetAt) return { moodId: '', moodExpiresAt: null };
  const expiresAt = new Date(p.moodSetAt.getTime() + MOOD_TTL_MS);
  if (expiresAt <= new Date()) return { moodId: '', moodExpiresAt: null };
  return { moodId: p.moodId, moodExpiresAt: expiresAt };
}

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
    musicGenres: p.musicGenres as string[],
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
    vibeArchetypeId: p.vibeArchetypeId,
    moodId: activeMood(p).moodId,
    ...(opts.owner ? { moodExpiresAt: activeMood(p).moodExpiresAt } : {}),
    // Faz 16: kozmetik mağaza. Çerçeve/rozet profilde herkese görünür; sohbet temaları sadece
    // sahibinin kendi görünümünü etkilediği için başkasına döndürülmez.
    frameId: p.frameId,
    badgeId: p.badgeId,
    // Faz 17: "Sosyal cesaret yolculuğu" — toplam açılan kademe sayısı (0-12), keşfet kartında ve
    // profilde görünen güncel rozet. Ayrıntılı iz/kademe kırılımı sadece sahibine (GET /me) gider.
    // Kaldırılmış eski kademeler (ör. first_room_visit) sayılmaz
    milestoneCount: (p.milestones as string[]).filter((m) => (ALL_MILESTONES as readonly string[]).includes(m)).length,
    ...(opts.owner ? { chatBubbleThemeId: p.chatBubbleThemeId, chatBackgroundThemeId: p.chatBackgroundThemeId } : {}),
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
  // Faz 17: her açılışta (bu uç çekildiğinde) günlük giriş serisi güncellenir — aynı yerel günde
  // tekrar çağrılırsa etkisi olmaz.
  const streak = await touchStreak(user.id, user.tzOffsetMin);
  res.json({
    id: user.id,
    email: user.email,
    locale: user.locale,
    emailVerified: user.emailVerifiedAt !== null,
    verificationStatus: user.verificationStatus,
    verificationPose: user.verificationPose,
    boostedUntil: user.boostedUntil && user.boostedUntil > new Date() ? user.boostedUntil : null,
    likesUnlockedUntil: user.likesUnlockedUntil && user.likesUnlockedUntil > new Date() ? user.likesUnlockedUntil : null,
    // Faz 16: MeetPoint+ abonelik durumu (gerçek para, RevenueCat)
    premiumUntil: user.premiumUntil && user.premiumUntil > new Date() ? user.premiumUntil : null,
    // Faz 17: günlük giriş serisi
    streak: { current: streak.current, longest: streak.longest },
    // Faz 17 madde 8: davet programı — kendi kodu (eski hesaplarda null olabilir)
    referralCode: user.referralCode,
    // Faz 17: "Sosyal cesaret yolculuğu" — üç izin ayrıntılı kademe durumu
    achievements: tracksState(user.profile?.milestones ?? []),
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
  musicGenres: z
    .array(z.enum(MUSIC_GENRES))
    .max(MAX_MUSIC_GENRES)
    .default([])
    .transform((a) => [...new Set(a)]),
  lookingFor: z.enum(LOOKING_FOR).or(z.literal('')).default(''),
  heightCm: z.number().int().min(120).max(230).nullable().default(null),
  job: z.string().trim().max(60).default(''),
  education: z.enum(EDUCATION).or(z.literal('')).default(''),
  zodiac: z.enum(ZODIAC).or(z.literal('')).default(''),
  smoking: z.enum(HABIT).or(z.literal('')).default(''),
  drinking: z.enum(HABIT).or(z.literal('')).default(''),
  // themeId: ücretsiz katalog + mağazadan satın alınmış premium seçenekler aynı
  // alanı paylaşır (sahiplik kontrolü aşağıda assertOwned() ile yapılır, zod sadece kimliği doğrular)
  themeId: z.enum([...THEMES, ...STORE_THEMES]).or(z.literal('')).default(''),
  cardBackgroundId: z.enum(CARD_BACKGROUNDS).or(z.literal('')).default(''),
  // Faz 16: kozmetik mağaza — hepsi sahiplik gerektiren premium kataloglar (assertOwned())
  frameId: z.enum(STORE_FRAMES).or(z.literal('')).default(''),
  badgeId: z.enum(STORE_BADGES).or(z.literal('')).default(''),
  chatBubbleThemeId: z.enum(STORE_CHAT_BUBBLES).or(z.literal('')).default(''),
  chatBackgroundThemeId: z.enum(STORE_CHAT_BACKGROUNDS).or(z.literal('')).default(''),
});

profileRouter.put('/me/profile', requireNotRestricted, async (req, res) => {
  const data = profileSchema.parse(req.body);
  const owned = await ownedItemIds(uid(req));
  assertOwned(owned, data.themeId, STORE_THEMES);
  assertOwned(owned, data.frameId, STORE_FRAMES);
  assertOwned(owned, data.badgeId, STORE_BADGES);
  assertOwned(owned, data.chatBubbleThemeId, STORE_CHAT_BUBBLES);
  assertOwned(owned, data.chatBackgroundThemeId, STORE_CHAT_BACKGROUNDS);
  if (ageOf(data.birthDate) < config.minAge) throw new HttpError(403, 'underage');
  const userId = uid(req);
  // Kimi görmek istediğin (cinsel yönelim) özel nitelikli veridir: açık rıza olmadan kaydedilmez
  await requireConsent(userId, 'special_category');
  const saved = await prisma.profile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  // Vibe testini tamamladıysan, ilgi alanların değiştikçe arketip yeniden hesaplanır — statik bir
  // etiket değil, profilinle birlikte gelişen bir kimlik.
  const answers = saved.vibeAnswers as Record<string, string>;
  if (Object.keys(answers).length > 0) {
    const archetypeId = computeArchetype(answers, data.interests);
    if (archetypeId !== saved.vibeArchetypeId) {
      await prisma.profile.update({ where: { userId }, data: { vibeArchetypeId: archetypeId } });
    }
  }
  // Faz 17: "Sosyal cesaret yolculuğu" — Kimlik izi
  await checkProfileComplete(userId, saved);
  res.json({ ok: true });
});

// Faz 16: "Kendini Keşfet" vibe sistemi. Soru/seçenek kimlikleri src/vibe.ts'te; metinler app'te.
const vibeAnswersSchema = z.record(z.string(), z.string()).refine(
  (a) =>
    Object.keys(a).length === VIBE_QUESTIONS.length &&
    VIBE_QUESTIONS.every((q) => q.options.some((o) => o.id === a[q.id])),
  'invalid_vibe_answers',
);

// Faz 17: "Gelişimim" ekranı — üç izin kademe durumu zaten GET /me'de var (achievements); burada
// sadece o ekrana özel, daha az sık istenen veri: bağlam duyarlı "sıradaki adım" önerisi.
profileRouter.get('/me/journey', async (req, res) => {
  res.json({ nextStepHint: await nextStepHint(uid(req)) });
});

// Faz 17 madde 7: haftalık özet ("Bu hafta 3 yeni eşleşme, en uzun sohbetin X ile" gibi)
profileRouter.get('/me/weekly-digest', async (req, res) => {
  res.json(await weeklyDigest(uid(req)));
});

// Faz 17 madde 8: davet programı — özet (kendi kodu zaten GET /me'de; burada sadece ağır kısım).
// Kod uygulama (POST /me/referral/redeem) burada DEĞİL, src/routes/auth.ts'te: bu router
// requireVerifiedEmail'den sonra çalışır, ama kod tam olarak doğrulamadan ÖNCE uygulanabilmeli.
profileRouter.get('/me/referral', async (req, res) => {
  res.json(await referralStats(uid(req)));
});

profileRouter.get('/me/vibe', async (req, res) => {
  const p = await prisma.profile.findUniqueOrThrow({ where: { userId: uid(req) } });
  res.json({ answers: p.vibeAnswers, archetypeId: p.vibeArchetypeId });
});

profileRouter.put('/me/vibe', requireNotRestricted, async (req, res) => {
  const answers = vibeAnswersSchema.parse(req.body);
  const userId = uid(req);
  const p = await prisma.profile.findUniqueOrThrow({ where: { userId } });
  const archetypeId = computeArchetype(answers, p.interests as string[]);
  await prisma.profile.update({ where: { userId }, data: { vibeAnswers: answers, vibeArchetypeId: archetypeId } });
  // Faz 17: "Sosyal cesaret yolculuğu" — Kimlik izi
  await unlockMilestone(userId, 'vibe_done');
  res.json({ archetypeId });
});

// Faz 16: günlük ruh hali. Serbest metin yok, sadece küçük bir katalogdan seçim; 24 saatte kaybolur.
const moodSchema = z.object({ moodId: z.enum(MOODS) });

profileRouter.put('/me/mood', requireNotRestricted, async (req, res) => {
  const { moodId } = moodSchema.parse(req.body);
  await prisma.profile.update({ where: { userId: uid(req) }, data: { moodId, moodSetAt: new Date() } });
  res.json({ ok: true });
});

profileRouter.delete('/me/mood', async (req, res) => {
  await prisma.profile.update({ where: { userId: uid(req) }, data: { moodId: '', moodSetAt: null } });
  res.json({ ok: true });
});

// GEÇİCİ (test): Faz 17 günlük seri — zamanlayıcının kırılma riski hatırlatma işini hemen
// çalıştırır (gerçek akışta scheduler.ts'te periyodiktir). Testte saati simüle edebilmek için
// `now` gönderilebilir. Yayında bu uç kapalıdır.
profileRouter.post('/dev/streak-reminders', async (req, res) => {
  if (config.isProduction) throw new HttpError(404, 'not_found');
  const { now } = z.object({ now: z.coerce.date().optional() }).parse(req.body ?? {});
  await sendStreakReminders(now);
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

