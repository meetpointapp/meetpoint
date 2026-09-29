import { prisma } from './db';

// Faz 17 madde 7: haftalık özet. Yapay zekâ yok — son 7 günün basit, kural tabanlı sayımları:
// yeni eşleşme sayısı ve en çok mesajlaşılan (iki yönlü toplam) sohbet.
export async function weeklyDigest(userId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const newMatches = await prisma.conversation.count({
    where: { OR: [{ userAId: userId }, { userBId: userId }], origin: 'MATCH', createdAt: { gte: since } },
  });

  const myConversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true, userAId: true, userBId: true },
  });

  let longestChat: { conversationId: string; otherUserId: string; otherName: string; messageCount: number } | null = null;
  if (myConversations.length > 0) {
    const counts = await prisma.message.groupBy({
      by: ['conversationId'],
      where: { conversationId: { in: myConversations.map((c) => c.id) }, createdAt: { gte: since } },
      _count: { _all: true },
    });
    const top = counts.sort((a, b) => b._count._all - a._count._all)[0];
    if (top && top._count._all > 0) {
      const conv = myConversations.find((c) => c.id === top.conversationId)!;
      const otherUserId = conv.userAId === userId ? conv.userBId : conv.userAId;
      const other = await prisma.profile.findUnique({ where: { userId: otherUserId }, select: { displayName: true } });
      if (other) {
        longestChat = { conversationId: conv.id, otherUserId, otherName: other.displayName, messageCount: top._count._all };
      }
    }
  }

  return { since, newMatches, longestChat };
}
