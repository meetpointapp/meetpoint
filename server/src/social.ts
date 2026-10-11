import type { Prisma } from '@prisma/client';
import { HttpError, prisma } from './db';

// Faz 22: sosyal akış — ortak yardımcılar (kotalar, doğrulama, görünürlük). Rotalar: routes/social.ts

export const social = {
  postMax: 280,
  commentMax: 240,
  storyTextMax: 200,
  postsPerDay: 5,
  commentsPerDay: 60,
  storiesPerDay: 10,
  storyHours: 24,
  feedPage: 20,
  commentPage: 30,
  listPage: 30,
  // Hikaye metin zeminleri (uygulamadaki gradyan listesiyle aynı kimlikler)
  storyBackgrounds: ['sunset', 'ocean', 'forest', 'grape', 'night', 'rose', 'gold'] as const,
};

const DAY = 86_400_000;
export const dayAgo = () => new Date(Date.now() - DAY);

// Yazma yetkisi: gönderi, yorum ve hikaye sadece mavi tikli (doğrulanmış) hesaplara açık. Okuma, beğeni
// ve takip herkese açık. Böylece sahte hesap, spam ve taciz yükü azalır.
export async function requireVerified(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { verificationStatus: true } });
  if (u?.verificationStatus !== 'approved') throw new HttpError(403, 'verification_required');
}

// Bu kullanıcıyla (iki yönde) engel ilişkisi olan herkesin kimliği
export async function blockedIdsOf(userId: string): Promise<string[]> {
  const rows = await prisma.block.findMany({
    where: { OR: [{ fromId: userId }, { toId: userId }] },
    select: { fromId: true, toId: true },
  });
  return [...new Set(rows.map((r) => (r.fromId === userId ? r.toId : r.fromId)))];
}

// Akışta görünebilecek yazar: yasaklı veya silinme sürecindeki hesaplar görünmez
export const visibleAuthor: Prisma.UserWhereInput = { bannedAt: null, deletionRequestedAt: null };

// Takip sayıları ve izleyicinin ilişkisi (profilde gösterilir)
export async function socialStats(targetId: string, viewerId: string) {
  const [followers, following, posts, iFollow, followsMe] = await Promise.all([
    prisma.follow.count({ where: { followingId: targetId } }),
    prisma.follow.count({ where: { followerId: targetId } }),
    prisma.post.count({ where: { authorId: targetId, hiddenAt: null } }),
    viewerId === targetId ? false : prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: targetId } } }).then(Boolean),
    viewerId === targetId ? false : prisma.follow.findUnique({ where: { followerId_followingId: { followerId: targetId, followingId: viewerId } } }).then(Boolean),
  ]);
  return { followers, following, posts, isFollowing: iFollow, followsMe };
}

// Engellenince iki yönlü takip de silinir
export async function dropFollowsBetween(a: string, b: string) {
  await prisma.follow.deleteMany({
    where: { OR: [{ followerId: a, followingId: b }, { followerId: b, followingId: a }] },
  });
}

// "createdAt|id" imleci (sayfalama). Bozuk imleç yok sayılır.
export function parseCursor(raw: unknown): { createdAt: Date; id: string } | null {
  if (typeof raw !== 'string') return null;
  const i = raw.indexOf('|');
  if (i < 0) return null;
  const ms = Number(raw.slice(0, i));
  const id = raw.slice(i + 1);
  if (!Number.isFinite(ms) || !id) return null;
  return { createdAt: new Date(ms), id };
}

export const cursorOf = (row: { createdAt: Date; id: string }) => `${row.createdAt.getTime()}|${row.id}`;

// Kısa özet: bildirim ve şikayet kopyası için
export const snippet = (text: string, n = 120) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);
