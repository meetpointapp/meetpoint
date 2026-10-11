import { economy } from './config';
import { prisma } from './db';

// Faz 20: süper beğeni hakları. Her kullanıcının günlük ücretsiz bir hakkı vardır (kayan 24 saatte
// economy.superLike.daily; VibeUpMe+ için dailyPremium). Bitince satın alınmış haklar
// (Profile.superLikeCredits) kullanılır; ikisi de yoksa uygulama paket satın alma sayfası gösterir.
// Ücretsiz hak ayrı sayaç tutmaz: son 24 saatte atılan süper beğeni sayısından hesaplanır.

export async function superLikeStatus(userId: string, now = new Date()) {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { premiumUntil: true } }),
    prisma.profile.findUnique({ where: { userId }, select: { superLikeCredits: true } }),
  ]);
  const cfg = economy.superLike;
  const premium = !!user?.premiumUntil && user.premiumUntil > now;
  const daily = premium ? cfg.dailyPremium : cfg.daily;
  const windowMs = cfg.windowHours * 3_600_000;
  const where = { fromId: userId, direction: 'superlike', superPaid: false, createdAt: { gt: new Date(now.getTime() - windowMs) } };
  const [used, oldest] = await Promise.all([
    prisma.swipe.count({ where }),
    prisma.swipe.findFirst({ where, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ]);
  const freeRemaining = Math.max(0, daily - used);
  const credits = profile?.superLikeCredits ?? 0;
  return {
    daily,
    used,
    freeRemaining,
    credits,
    total: freeRemaining + credits,
    premium,
    // VibeUpMe+ ekranında gösterilen avantaj sayıları
    freeDaily: cfg.daily,
    premiumDaily: cfg.dailyPremium,
    likeLimitFree: economy.likeLimit,
    likeLimitPremium: economy.likeLimitPremium,
    // En eski ücretsiz kullanımın penceresi dolunca bir hak geri gelir
    nextFreeAt: oldest ? new Date(oldest.createdAt.getTime() + windowMs) : null,
    packs: cfg.packs.map((p) => ({ id: p.id, count: p.count, price: p.price, unitPrice: Math.round((p.price / p.count) * 10) / 10 })),
  };
}
