// Faz 16: "Kendini Keşfet" vibe sistemi. Yapay zekâ YOK — kısa bir soru seti cevapları 4 eksende
// (macera, sosyal, spontane, romantik) puanlar; sonuç, en yakın "arketip" vektörüne en kısa öklid
// mesafesiyle eşlenir (basit, deterministik kural). İlgi alanları küçük bir "dürtme" katkısı yapar,
// böylece profil güncellendikçe (yeni ilgi alanı) arketip statik kalmaz, yeniden hesaplanabilir.
// Soru/seçenek/arketip METİNLERİ burada YOK — diğer kataloglar gibi sadece kimlikler var; çeviriler
// app/lib/l10n/*.arb içinde.

export const VIBE_AXES = ['macera', 'sosyal', 'spontane', 'romantik'] as const;
export type VibeAxis = (typeof VIBE_AXES)[number];
export type VibeVector = Record<VibeAxis, number>;

export interface VibeOption {
  id: string;
  deltas: Partial<Record<VibeAxis, number>>;
}
export interface VibeQuestion {
  id: string;
  options: VibeOption[];
}

export const VIBE_QUESTIONS: VibeQuestion[] = [
  {
    id: 'ideal_date',
    options: [
      { id: 'road_trip', deltas: { spontane: 2, macera: 1 } },
      { id: 'cafe_chat', deltas: { macera: -2, sosyal: -1 } },
      { id: 'concert', deltas: { sosyal: 2, spontane: 1 } },
      { id: 'candlelit_dinner', deltas: { romantik: 2, spontane: -1 } },
    ],
  },
  {
    id: 'flirt_style',
    options: [
      { id: 'direct', deltas: { macera: 1, spontane: 1 } },
      { id: 'slow_burn', deltas: { macera: -1, romantik: 1 } },
      { id: 'playful', deltas: { sosyal: 1, spontane: 1 } },
      { id: 'deep_talk', deltas: { sosyal: -1, romantik: 1 } },
    ],
  },
  {
    id: 'weekend',
    options: [
      { id: 'explore_new_place', deltas: { macera: 2 } },
      { id: 'stay_in', deltas: { macera: -2, sosyal: -1 } },
      { id: 'spontaneous_hangout', deltas: { sosyal: 2, spontane: 1 } },
      { id: 'planned_activity', deltas: { spontane: -2 } },
    ],
  },
  {
    id: 'communication',
    options: [
      { id: 'frequent_texts', deltas: { sosyal: 1, spontane: 1 } },
      { id: 'rare_deep', deltas: { sosyal: -1, romantik: 1 } },
      { id: 'voice_notes', deltas: { spontane: 1, macera: 1 } },
      { id: 'plans_ahead', deltas: { spontane: -1, romantik: -1 } },
    ],
  },
  {
    id: 'conflict',
    options: [
      { id: 'talk_now', deltas: { macera: 1, spontane: 1 } },
      { id: 'cool_off_first', deltas: { macera: -1, spontane: -1 } },
      { id: 'bring_others', deltas: { sosyal: 1 } },
      { id: 'write_it_out', deltas: { sosyal: -1, romantik: 1 } },
    ],
  },
  {
    id: 'dream_trip',
    options: [
      { id: 'backpacking', deltas: { macera: 2, spontane: 1 } },
      { id: 'quiet_cabin', deltas: { macera: -2, sosyal: -1 } },
      { id: 'group_tour', deltas: { sosyal: 2 } },
      { id: 'romantic_getaway', deltas: { romantik: 2 } },
    ],
  },
  {
    id: 'friday_night',
    options: [
      { id: 'new_experience', deltas: { macera: 1, spontane: 2 } },
      { id: 'movie_at_home', deltas: { macera: -1, spontane: -1 } },
      { id: 'party', deltas: { sosyal: 2, spontane: 1 } },
      { id: 'one_on_one', deltas: { sosyal: -2, romantik: 1 } },
    ],
  },
  {
    id: 'gift_style',
    options: [
      { id: 'surprise_adventure', deltas: { macera: 1, spontane: 2 } },
      { id: 'practical', deltas: { spontane: -2 } },
      { id: 'shared_experience', deltas: { sosyal: 1, spontane: 1 } },
      { id: 'handwritten_note', deltas: { romantik: 2 } },
    ],
  },
  {
    id: 'social_battery',
    options: [
      { id: 'crowd_energizes', deltas: { sosyal: 2, spontane: 1 } },
      { id: 'small_group', deltas: { sosyal: 0 } },
      { id: 'one_friend', deltas: { sosyal: -1, romantik: 1 } },
      { id: 'alone_time', deltas: { sosyal: -2, macera: -1 } },
    ],
  },
  {
    id: 'love_language',
    options: [
      { id: 'adventure_together', deltas: { macera: 2, romantik: 1 } },
      { id: 'words', deltas: { romantik: 2, sosyal: -1 } },
      { id: 'fun_together', deltas: { sosyal: 2, spontane: 1 } },
      { id: 'reliability', deltas: { spontane: -2, romantik: 1 } },
    ],
  },
];

export interface VibeArchetype {
  id: string;
  vector: VibeVector;
}

export const VIBE_ARCHETYPES: VibeArchetype[] = [
  { id: 'maceraci_romantik', vector: { macera: 2, sosyal: 0, spontane: 1, romantik: 2 } },
  { id: 'sakin_gozlemci', vector: { macera: -2, sosyal: -1, spontane: -1, romantik: 0 } },
  { id: 'sosyal_kelebek', vector: { macera: 1, sosyal: 2, spontane: 1, romantik: 0 } },
  { id: 'pragmatik_planlayici', vector: { macera: -1, sosyal: 0, spontane: -2, romantik: -1 } },
  { id: 'tutkulu_idealist', vector: { macera: 0, sosyal: 1, spontane: 0, romantik: 2 } },
  { id: 'ozgur_ruh', vector: { macera: 2, sosyal: 1, spontane: 2, romantik: 0 } },
  { id: 'sadik_yoldas', vector: { macera: -1, sosyal: -1, spontane: -1, romantik: 1 } },
  { id: 'merakli_kasif', vector: { macera: 2, sosyal: 0, spontane: 2, romantik: -1 } },
  { id: 'duygusal_derinlik', vector: { macera: -1, sosyal: -1, spontane: -1, romantik: 2 } },
  { id: 'eglence_duskunu', vector: { macera: 1, sosyal: 2, spontane: 2, romantik: 0 } },
  { id: 'sessiz_guc', vector: { macera: 0, sosyal: -2, spontane: -1, romantik: 1 } },
  { id: 'dengeli_ruh', vector: { macera: 0, sosyal: 0, spontane: 0, romantik: 0 } },
];

// İlgi alanları küçük bir dürtme yapar (max 5 ilgi alanı seçilebilir, her biri ±1) — büyük skor
// farklarından çok daha küçük bir etki, tek başına arketipi belirlemez ama "profil güncellendikçe
// yeniden hesaplanır" hissi verir.
const INTEREST_VIBE_NUDGE: Partial<Record<string, Partial<Record<VibeAxis, number>>>> = {
  travel: { macera: 1 },
  hiking: { macera: 1 },
  camping: { macera: 1, spontane: 1 },
  running: { macera: 1 },
  cycling: { macera: 1 },
  fitness: { macera: 1 },
  photography: { macera: 1 },
  yoga: { macera: -1 },
  meditation: { macera: -1, spontane: -1 },
  books: { sosyal: -1 },
  series: { macera: -1 },
  gaming: { sosyal: -1 },
  anime: { sosyal: -1 },
  coffee: { sosyal: 1 },
  concerts: { sosyal: 1, spontane: 1 },
  dancing: { sosyal: 1, spontane: 1 },
  football: { sosyal: 1 },
  basketball: { sosyal: 1 },
  fashion: { sosyal: 1 },
  foodie: { spontane: 1 },
  beach: { spontane: 1 },
  wine: { romantik: 1 },
  cooking: { romantik: 1 },
  art: { romantik: 1 },
  pets: { romantik: 1 },
  volunteering: { romantik: 1, sosyal: 1 },
};

function zeroVector(): VibeVector {
  return { macera: 0, sosyal: 0, spontane: 0, romantik: 0 };
}

export function computeVibeVector(answers: Record<string, string>, interests: string[]): VibeVector {
  const v = zeroVector();
  for (const q of VIBE_QUESTIONS) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    if (!opt) continue;
    for (const axis of VIBE_AXES) v[axis] += opt.deltas[axis] ?? 0;
  }
  for (const interest of interests) {
    const nudge = INTEREST_VIBE_NUDGE[interest];
    if (!nudge) continue;
    for (const axis of VIBE_AXES) v[axis] += nudge[axis] ?? 0;
  }
  return v;
}

export function nearestArchetype(vector: VibeVector): string {
  let best = VIBE_ARCHETYPES[0];
  let bestDist = Infinity;
  for (const a of VIBE_ARCHETYPES) {
    const dist = VIBE_AXES.reduce((s, ax) => s + (vector[ax] - a.vector[ax]) ** 2, 0);
    if (dist < bestDist) {
      bestDist = dist;
      best = a;
    }
  }
  return best.id;
}

export function computeArchetype(answers: Record<string, string>, interests: string[]): string {
  return nearestArchetype(computeVibeVector(answers, interests));
}

// Eşleştiğin kişiyle "uyum notu": iki arketip vektörü arasındaki mesafeye göre 3 kademeli, kural
// tabanlı bir sınıflandırma (benzer / tamamlayıcı / zıt kutuplar). Metin app tarafında l10n'den gelir.
export type VibeCompatTier = 'similar' | 'complementary' | 'opposite';

export function compatibilityTier(archetypeIdA: string, archetypeIdB: string): VibeCompatTier {
  const a = VIBE_ARCHETYPES.find((x) => x.id === archetypeIdA);
  const b = VIBE_ARCHETYPES.find((x) => x.id === archetypeIdB);
  if (!a || !b) return 'similar';
  const dist = Math.sqrt(VIBE_AXES.reduce((s, ax) => s + (a.vector[ax] - b.vector[ax]) ** 2, 0));
  if (dist <= 2.5) return 'similar';
  if (dist <= 4.5) return 'complementary';
  return 'opposite';
}

export const VIBE_QUESTION_IDS = VIBE_QUESTIONS.map((q) => q.id);
export const VIBE_ARCHETYPE_IDS = VIBE_ARCHETYPES.map((a) => a.id);
