// Profil kataloğu. Uygulama bu kimliklerin çevirilerini kendi dil dosyalarında tutar;
// buraya kimlik eklenirse app/lib/l10n/*.arb dosyalarına da eklenmeli.

export const INTERESTS = [
  'coffee', 'travel', 'music', 'concerts', 'movies', 'series', 'books', 'photography',
  'art', 'cooking', 'foodie', 'wine', 'fitness', 'yoga', 'running', 'cycling',
  'hiking', 'camping', 'football', 'basketball', 'gaming', 'tech', 'fashion', 'dancing',
  'pets', 'nature', 'beach', 'meditation', 'anime', 'volunteering',
] as const;

export const PROMPTS = [
  'perfect_sunday', 'laugh', 'green_flag', 'travel_dream', 'unpopular_opinion',
  'simple_pleasures', 'looking_for', 'two_truths', 'first_date', 'song',
] as const;

export const LOOKING_FOR = ['relationship', 'casual', 'friendship', 'chat', 'unsure'] as const;
export const EDUCATION = ['high_school', 'bachelor', 'master', 'phd'] as const;
export const HABIT = ['no', 'sometimes', 'yes'] as const;
export const ZODIAC = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;

// Selfie doğrulamada istenen pozlar (uygulama kendi dilinde açıklamasını gösterir)
export const VERIFICATION_POSES = ['peace_sign', 'thumbs_up', 'hand_on_head', 'point_up', 'wave'] as const;

export const MAX_INTERESTS = 5;
export const MAX_PROMPTS = 3;

// Faz 16: kişisel profil vitrini. Renk (rozet/vurgu) ve arkaplan (kart zemini) ayrı seçilir; ''
// varsayılan marka görünümü demektir. Renkler/gradyanlar uygulamada core/catalog.dart'ta tutulur,
// burada sadece kimlikler doğrulanır (sunucu görsel bir şey saklamaz).
export const THEMES = ['coral', 'ocean', 'sunset', 'forest', 'lavender', 'rose'] as const;
export const CARD_BACKGROUNDS = ['default', 'ocean', 'sunset', 'forest', 'lavender', 'midnight'] as const;

// Faz 16: çizgi avatar. Renkler/çizim uygulamada core/catalog.dart'ta; burada sadece kimlik doğrulanır.
export const AVATAR_SKINS = ['light', 'medium', 'tan', 'brown', 'dark'] as const;
export const AVATAR_HAIR_STYLES = ['bald', 'short', 'long', 'curly'] as const;
export const AVATAR_HAIR_COLORS = ['black', 'brown', 'blonde', 'red', 'gray'] as const;
export const AVATAR_OUTFITS = ['coral', 'ocean', 'sunset', 'forest', 'lavender', 'midnight'] as const;
export const AVATAR_ACCESSORIES = ['none', 'glasses', 'hat', 'headphones'] as const;

// Faz 16: kendi oda. Statik yerleşim (gerçek zamanlı gezinme yok) — her eşya bir ızgara hücresinde.
export const ROOM_WALLPAPERS = ['plain', 'coral', 'ocean', 'sunset', 'forest', 'lavender'] as const;
export const ROOM_FLOORS = ['wood', 'tile', 'coral', 'ocean'] as const;
export const ROOM_ITEMS = ['sofa', 'bed', 'plant', 'lamp', 'tv', 'bookshelf', 'table', 'rug', 'window', 'picture'] as const;
export const ROOM_GRID_W = 4;
export const ROOM_GRID_H = 5;
export const ROOM_MAX_ITEMS = 12;

// Faz 16: günlük ruh hali. Serbest metin yok (moderasyon gerektirmez); 24 saatte kendiliğinden
// kaybolur (bkz. src/routes/profile.ts activeMood()). Emoji uygulamada core/catalog.dart'ta.
export const MOODS = [
  'happy', 'excited', 'relaxed', 'romantic', 'tired', 'stressed',
  'grateful', 'adventurous', 'lonely', 'busy', 'hopeful', 'bored',
] as const;
export const MOOD_TTL_MS = 24 * 60 * 60 * 1000;
