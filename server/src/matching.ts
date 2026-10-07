import { INTERESTS, ZODIAC } from './catalog';
import { compatibilityTier } from './vibe';

// Faz 20: eşleştirme modları — keşfet ekranında üstteki düğmelerle (astroloji, müzik, ilgi, vibe)
// seçilir. Yapay zekâ ve dış servis YOK: hepsi bilinen kurallarla hesaplanan, deterministik skorlardır.
// Sunucu sadece kimlik + parametre döner; açıklama metni uygulamada l10n'den gelir.

export const MATCH_MODES = ['all', 'astro', 'music', 'interests', 'vibe'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export interface MatchReason {
  mode: Exclude<MatchMode, 'all'>;
  score: number; // 0-100, sıralama için
  key: string; // l10n kimliği (ör. astro_trine)
  args: string[]; // metne girecek kimlikler (burç, müzik türü, ilgi alanı, arketip)
}

interface MatchProfile {
  birthDate: Date;
  zodiac: string;
  interests: unknown;
  musicGenres: unknown;
  vibeArchetypeId: string;
}

// ---------- Burç
// Tropikal burç sınırları [ay, gün]: bu tarihten itibaren ilgili burç başlar.
const ZODIAC_STARTS: [number, number, (typeof ZODIAC)[number]][] = [
  [1, 20, 'aquarius'], [2, 19, 'pisces'], [3, 21, 'aries'], [4, 20, 'taurus'],
  [5, 21, 'gemini'], [6, 21, 'cancer'], [7, 23, 'leo'], [8, 23, 'virgo'],
  [9, 23, 'libra'], [10, 23, 'scorpio'], [11, 22, 'sagittarius'], [12, 22, 'capricorn'],
];

export function zodiacFromDate(d: Date): (typeof ZODIAC)[number] {
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  let sign: (typeof ZODIAC)[number] = 'capricorn'; // 1-19 Ocak
  for (const [sm, sd, id] of ZODIAC_STARTS) {
    if (m > sm || (m === sm && day >= sd)) sign = id;
  }
  return sign;
}

// Seçilmiş burç varsa o, yoksa doğum tarihinden hesaplanan
export function zodiacOf(p: Pick<MatchProfile, 'birthDate' | 'zodiac'>): (typeof ZODIAC)[number] {
  return (ZODIAC as readonly string[]).includes(p.zodiac) ? (p.zodiac as (typeof ZODIAC)[number]) : zodiacFromDate(p.birthDate);
}

// Burç dairesindeki açıya göre klasik "aspect": üçgen (aynı element) en uyumlu, karşıt burçlar
// birbirini çeker, kare (ör. Akrep–Aslan) kıvılcım çıkarır. Sıralama skoru ve açıklama kimliği döner.
const ASPECTS: Record<number, { key: string; score: number }> = {
  0: { key: 'astro_same', score: 75 },
  1: { key: 'astro_neighbor', score: 55 },
  2: { key: 'astro_sextile', score: 85 },
  3: { key: 'astro_square', score: 70 },
  4: { key: 'astro_trine', score: 95 },
  5: { key: 'astro_quincunx', score: 50 },
  6: { key: 'astro_opposite', score: 80 },
};
const ASTRO_MIN_SCORE = 70;

export function astroCompat(a: (typeof ZODIAC)[number], b: (typeof ZODIAC)[number]): MatchReason | null {
  const diff = Math.abs(ZODIAC.indexOf(a) - ZODIAC.indexOf(b));
  const aspect = ASPECTS[Math.min(diff, 12 - diff)];
  if (aspect.score < ASTRO_MIN_SCORE) return null;
  return { mode: 'astro', score: aspect.score, key: aspect.key, args: [a, b] };
}

// ---------- Müzik / ilgi alanı / vibe
function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function musicCompat(my: Pick<MatchProfile, 'musicGenres'>, their: Pick<MatchProfile, 'musicGenres'>): MatchReason | null {
  const mine = new Set(strings(my.musicGenres));
  const shared = strings(their.musicGenres).filter((g) => mine.has(g));
  if (shared.length === 0) return null;
  return { mode: 'music', score: Math.min(100, 50 + shared.length * 20), key: 'music_shared', args: shared.slice(0, 3) };
}

export function interestsCompat(my: Pick<MatchProfile, 'interests'>, their: Pick<MatchProfile, 'interests'>): MatchReason | null {
  const mine = new Set(strings(my.interests));
  const shared = strings(their.interests).filter((g) => mine.has(g) && (INTERESTS as readonly string[]).includes(g));
  if (shared.length === 0) return null;
  return { mode: 'interests', score: Math.min(100, 40 + shared.length * 20), key: 'interests_shared', args: shared.slice(0, 3) };
}

export function vibeCompat(my: Pick<MatchProfile, 'vibeArchetypeId'>, their: Pick<MatchProfile, 'vibeArchetypeId'>): MatchReason | null {
  if (!my.vibeArchetypeId || !their.vibeArchetypeId) return null;
  const tier = compatibilityTier(my.vibeArchetypeId, their.vibeArchetypeId);
  if (tier === 'opposite') return null;
  return {
    mode: 'vibe',
    score: tier === 'similar' ? 90 : 75,
    key: tier === 'similar' ? 'vibe_similar' : 'vibe_complementary',
    args: [my.vibeArchetypeId, their.vibeArchetypeId],
  };
}

export function matchReason(mode: Exclude<MatchMode, 'all'>, my: MatchProfile, their: MatchProfile): MatchReason | null {
  switch (mode) {
    case 'astro':
      return astroCompat(zodiacOf(my), zodiacOf(their));
    case 'music':
      return musicCompat(my, their);
    case 'interests':
      return interestsCompat(my, their);
    case 'vibe':
      return vibeCompat(my, their);
  }
}
