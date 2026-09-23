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
