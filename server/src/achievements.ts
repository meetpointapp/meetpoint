import { prisma } from './db';

// Faz 17: "Sosyal cesaret yolculuğu". Üç izde (İletişim, Bağlantı, Kimlik) kademeli ilerleme;
// her iz kendi içinde 3 kademe taşır (bronz/gümüş/altın). Puana değil gerçek eyleme dayalı: her
// kademe kimliği bu dosyadaki tetikleyicilerden biri gerçekleştiğinde bir kez ve kalıcı olarak
// açılır (src/routes/*.ts içindeki unlockMilestone() çağrıları). Her kademe, Faz 16'daki kozmetik
// mağazadan ücretsiz bir ödül açar (MILESTONE_REWARD → StorePurchase, jeton harcanmadan).
export const TRACKS = ['iletisim', 'baglanti', 'kimlik'] as const;
export type Track = (typeof TRACKS)[number];

// Sıra önemli: bir izdeki N'inci kademe = bu dizideki N'inci kimlik tamamlandığında açılır.
export const TRACK_MILESTONES: Record<Track, readonly string[]> = {
  // "first_icebreaker" Faz 17 madde 4 (buz kırıcı mini oyunlar) inşa edilince tetiklenecek —
  // o zamana kadar bu izin altın kademesi doğal olarak açılmaz (özellik henüz yok).
  iletisim: ['first_message', 'week_long_chat', 'first_icebreaker'],
  baglanti: ['first_match', 'first_room_visit', 'first_call'],
  kimlik: ['profile_complete', 'verified', 'vibe_done'],
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
