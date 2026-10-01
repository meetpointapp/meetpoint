import { isBlockedEitherWay, prisma } from './db';
import { getFinance } from './finance/settings';

// Faz 17: "Sosyal cesaret yolculuğu". Üç izde (İletişim, Bağlantı, Kimlik) kademeli ilerleme;
// her iz kendi içinde 3 kademe taşır (bronz/gümüş/altın). Puana değil gerçek eyleme dayalı: her
// kademe kimliği bu dosyadaki tetikleyicilerden biri gerçekleştiğinde bir kez ve kalıcı olarak
// açılır (src/routes/*.ts içindeki unlockMilestone() çağrıları). Her kademe, Faz 16'daki kozmetik
// mağazadan ücretsiz bir ödül açar (MILESTONE_REWARD → StorePurchase, jeton harcanmadan).
export const TRACKS = ['iletisim', 'baglanti', 'kimlik', 'kazanc'] as const;
export type Track = (typeof TRACKS)[number];

// Sıra önemli: bir izdeki N'inci kademe = bu dizideki N'inci kimlik tamamlandığında açılır.
export const TRACK_MILESTONES: Record<Track, readonly string[]> = {
  // "first_icebreaker": sohbet içi buz kırıcı mini oyun bir tur tamamlanınca (başlat + cevapla)
  // her iki tarafta da açılır — bkz. src/routes/conversations.ts icebreaker/:gameId/answer.
  iletisim: ['first_message', 'week_long_chat', 'first_icebreaker'],
  baglanti: ['first_match', 'first_room_visit', 'first_call'],
  kimlik: ['profile_complete', 'verified', 'vibe_done'],
  // Faz 19: gerçek para kazanma adımları. Eşik, o ana kadar başkalarından kazanılan TÜM jetonun
  // (bozdurulmuş olsun olmasın) bugünkü bozdurma kuruyla USD karşılığına göre — bkz. checkEarningMilestones.
  kazanc: ['first_earning', 'earning_50usd', 'earning_100usd'],
};

export const ALL_MILESTONES = TRACKS.flatMap((t) => TRACK_MILESTONES[t]);
export type MilestoneId = (typeof ALL_MILESTONES)[number];

// Her kademede açılan ücretsiz kozmetik ödül (src/catalog.ts kimlikleri)
export const MILESTONE_REWARD: Record<MilestoneId, string> = {
  first_message: 'bubble_mint',
  week_long_chat: 'chatbg_minimal',
  first_icebreaker: 'bubble_sunset',
  first_match: 'frame_gold',
  first_room_visit: 'item_piano',
  first_call: 'outfit_superhero',
  profile_complete: 'theme_royal',
  verified: 'badge_diamond',
  vibe_done: 'theme_galaxy',
  first_earning: 'badge_crown',
  earning_50usd: 'frame_stars',
  earning_100usd: 'item_chandelier',
};

export function trackOf(milestoneId: string): Track {
  return TRACKS.find((t) => (TRACK_MILESTONES[t] as readonly string[]).includes(milestoneId))!;
}

// Bir izde bu kademe kaçıncı sırada (1 = bronz, 2 = gümüş, 3 = altın)
export function tierIndexOf(milestoneId: string): number {
  return TRACK_MILESTONES[trackOf(milestoneId)].indexOf(milestoneId) + 1;
}

// Kademeyi açar: zaten açıksa hiçbir şey yapmaz (idempotent — çağıran taraf her seferinde
// çağırabilir, örn. her mesaj gönderiminde first_message). Profili olmayan kullanıcıda (onboarding
// bitmeden) sessizce atlanır.
export async function unlockMilestone(userId: string, milestoneId: MilestoneId) {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { milestones: true } });
  if (!profile) return null;
  const current = profile.milestones as string[];
  if (current.includes(milestoneId)) return null;
  const rewardItemId = MILESTONE_REWARD[milestoneId];
  await prisma.$transaction(async (tx) => {
    await tx.profile.update({ where: { userId }, data: { milestones: [...current, milestoneId] } });
    // Ücretsiz ödül: jeton harcanmadan sahiplik verilir (aynı satır zaten varsa dokunulmaz)
    await tx.storePurchase.upsert({
      where: { userId_itemId: { userId, itemId: rewardItemId } },
      create: { userId, itemId: rewardItemId },
      update: {},
    });
  });
  return { milestoneId, track: trackOf(milestoneId), tier: tierIndexOf(milestoneId), rewardItemId };
}

export type TrackState = { tier: number; milestones: { id: string; done: boolean }[] };

export function tracksState(milestones: unknown): Record<Track, TrackState> {
  const done = new Set(milestones as string[]);
  return Object.fromEntries(
    TRACKS.map((t) => [
      t,
      {
        tier: TRACK_MILESTONES[t].filter((m) => done.has(m)).length,
        milestones: TRACK_MILESTONES[t].map((id) => ({ id, done: done.has(id) })),
      },
    ]),
  ) as Record<Track, TrackState>;
}

// Faz 17 madde 6: profil tamamlanma yüzdesi — app/lib/features/me/me_screen.dart'taki
// profileCompletion() ile birebir aynı ağırlıklandırma (iki taraf da senkron tutulmalı).
export async function checkProfileComplete(
  userId: string,
  p: { interests: unknown; lookingFor: string; prompts: unknown; bio: string; heightCm: number | null; job: string; education: string; zodiac: string; city: string },
) {
  const photoCount = await prisma.photo.count({ where: { userId } });
  let score = Math.min(photoCount, 3) * 10; // 30
  if ((p.interests as unknown[]).length >= 3) score += 10;
  if (p.lookingFor) score += 10;
  score += Math.min((p.prompts as unknown[]).length, 3) * 10; // 30
  if (p.bio) score += 10;
  const basics = [p.heightCm != null, !!p.job, !!p.education, !!p.zodiac, !!p.city].filter(Boolean).length;
  if (basics >= 2) score += 10;
  if (score >= 100) await unlockMilestone(userId, 'profile_complete');
}

// Faz 19: kazanç kilometre taşları. Başkalarından kazanılan jetonların (WalletEntry type=EARN,
// bozdurulmuş olsun olmasın) toplamı, bugünkü bozdurma kuruyla USD karşılığına çevrilip eşiklerle
// karşılaştırılır. Her EARN kredisinden sonra çağrılır (idempotent, sırayla eşikleri geçer).
const EARNING_THRESHOLDS_USD: [MilestoneId, number][] = [
  ['first_earning', 0],
  ['earning_50usd', 50],
  ['earning_100usd', 100],
];

export async function checkEarningMilestones(userId: string) {
  const [sum, finance] = await Promise.all([
    prisma.walletEntry.aggregate({ where: { userId, type: 'EARN', amount: { gt: 0 } }, _sum: { amount: true } }),
    getFinance(),
  ]);
  const totalUsd = (sum._sum.amount ?? 0) * finance.cashoutUsdPerCoin;
  for (const [id, threshold] of EARNING_THRESHOLDS_USD) {
    if (totalUsd >= threshold) await unlockMilestone(userId, id);
  }
}

// Faz 17 madde 3 ("Gelişimim" ekranı): bağlam duyarlı "sıradaki adım" önerisi — yapay zekâ yok,
// var olan profil verisinden kural tabanlı üretilir. Henüz mesajlaşmaya başlamadığın en yeni
// eşleşmende, ortak bir ilgi alanınız varsa bunu konuşma açılışı olarak önerir.
export async function nextStepHint(userId: string) {
  const me = await prisma.profile.findUnique({ where: { userId }, select: { interests: true } });
  if (!me) return null;
  const myInterests = new Set(me.interests as string[]);
  if (myInterests.size === 0) return null;

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      userAId: true,
      userBId: true,
      messages: { where: { senderId: userId }, take: 1, select: { id: true } },
    },
  });
  for (const c of conversations) {
    if (c.messages.length > 0) continue; // zaten mesaj atmışsın, önerecek bir şey yok
    const otherId = c.userAId === userId ? c.userBId : c.userAId;
    if (await isBlockedEitherWay(userId, otherId)) continue;
    const other = await prisma.profile.findUnique({ where: { userId: otherId }, select: { displayName: true, interests: true } });
    if (!other) continue;
    const sharedInterest = (other.interests as string[]).find((i) => myInterests.has(i));
    if (sharedInterest) return { conversationId: c.id, otherUserId: otherId, otherName: other.displayName, interestId: sharedInterest };
  }
  return null;
}
