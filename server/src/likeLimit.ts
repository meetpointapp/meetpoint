import { economy } from './config';
import { prisma } from './db';

// Faz 20: keşfette beğeni hakkı. Kayan pencerede (economy.likeWindowHours, 24 saat) en fazla
// economy.likeLimit beğeni atılabilir; süper beğeni zaten jetonlu olduğu için sayılmaz. Hak bitince
// economy.likeResetPrice jetonla anında sıfırlanır: profildeki likesResetAt şimdiye çekilir ve sayım
// o andan başlar. Ayrı sayaç tutulmaz — var olan Swipe satırlarından hesaplanır (tutarlı, yarışsız).

export async function likeStatus(userId: string) {
  const [profile, user] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { likesResetAt: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { premiumUntil: true } }),
  ]);
  const premium = !!user?.premiumUntil && user.premiumUntil > new Date();
  const limit = premium ? economy.likeLimitPremium : economy.likeLimit;
  const windowMs = economy.likeWindowHours * 3_600_000;
  const windowStart = new Date(Date.now() - windowMs);
  const since = profile?.likesResetAt && profile.likesResetAt > windowStart ? profile.likesResetAt : windowStart;
  const where = { fromId: userId, direction: 'like', createdAt: { gt: since } };
  const [used, oldest] = await Promise.all([
    prisma.swipe.count({ where }),
    prisma.swipe.findFirst({ where, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ]);
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetPrice: economy.likeResetPrice,
    // En eski beğeninin penceresi dolunca bir hak kendiliğinden geri gelir
    nextFreeAt: oldest ? new Date(oldest.createdAt.getTime() + windowMs) : null,
  };
}
