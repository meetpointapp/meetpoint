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

// Faz 17: sohbet içi buz kırıcı — "bu mu o mu". Sabit bir katalog (serbest metin yok, moderasyon
// gerekmez); her ikisinin A/B seçenek metinleri app/lib/l10n/*.arb'de.
export const THIS_OR_THAT_PROMPTS = [
  'sea_or_mountain', 'coffee_or_tea', 'morning_or_night', 'city_or_nature',
  'book_or_movie', 'summer_or_winter', 'planned_or_spontaneous', 'home_or_travel',
] as const;
export const EDUCATION = ['high_school', 'bachelor', 'master', 'phd'] as const;
export const HABIT = ['no', 'sometimes', 'yes'] as const;
export const ZODIAC = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;

// Selfie doğrulamada istenen pozlar (uygulama kendi dilinde açıklamasını gösterir)
export const VERIFICATION_POSES = ['peace_sign', 'thumbs_up', 'hand_on_head', 'point_up', 'wave'] as const;

// Faz 20: müzik zevki — "Müzik" eşleştirme modu ortak türlere göre öneri yapar
export const MUSIC_GENRES = [
  'pop', 'rock', 'rap', 'electronic', 'jazz', 'classical', 'arabesk', 'turkish_folk',
  'turkish_pop', 'metal', 'rnb', 'indie', 'latin', 'kpop', 'reggae', 'blues',
] as const;
export const MAX_MUSIC_GENRES = 4;

export const MAX_INTERESTS = 5;
export const MAX_PROMPTS = 3;

// Faz 16: kişisel profil vitrini. Renk (rozet/vurgu) ve arkaplan (kart zemini) ayrı seçilir; ''
// varsayılan marka görünümü demektir. Renkler/gradyanlar uygulamada core/catalog.dart'ta tutulur,
// burada sadece kimlikler doğrulanır (sunucu görsel bir şey saklamaz).
export const THEMES = ['coral', 'ocean', 'sunset', 'forest', 'lavender', 'rose'] as const;
export const CARD_BACKGROUNDS = ['default', 'ocean', 'sunset', 'forest', 'lavender', 'midnight'] as const;

// Faz 16: günlük ruh hali. Serbest metin yok (moderasyon gerektirmez); 24 saatte kendiliğinden
// kaybolur (bkz. src/routes/profile.ts activeMood()). Emoji uygulamada core/catalog.dart'ta.
export const MOODS = [
  'happy', 'excited', 'relaxed', 'romantic', 'tired', 'stressed',
  'grateful', 'adventurous', 'lonely', 'busy', 'hopeful', 'bored',
] as const;
export const MOOD_TTL_MS = 24 * 60 * 60 * 1000;

// Faz 16: kozmetik mağaza. Jetonla alınan, ücretsiz kataloglara ek premium seçenekler. Bu jetonlar
// kullanıcıdan kullanıcıya geçmez (hepsi platform geliri). Renk/görsel tasarımı app/lib/core/catalog.dart'ta.
export const STORE_FRAMES = ['frame_gold', 'frame_neon', 'frame_floral', 'frame_stars', 'frame_rainbow', 'frame_fire'] as const;
export const STORE_BADGES = ['badge_crown', 'badge_fire', 'badge_diamond', 'badge_heart', 'badge_star', 'badge_rocket', 'badge_cat', 'badge_music'] as const;
// themeId alanına eklenen premium seçenekler (ücretsiz THEMES ile aynı alan, sahiplik gerekir)
export const STORE_THEMES = ['theme_galaxy', 'theme_fire', 'theme_ice', 'theme_royal'] as const;
// Sadece sahibinin kendi sohbet görünümünü etkiler (başkasına gösterilmez)
export const STORE_CHAT_BUBBLES = [
  'bubble_midnight', 'bubble_sunset', 'bubble_mint', 'bubble_rosegold',
  'bubble_ocean', 'bubble_neon', 'bubble_aurora', 'bubble_gold', 'bubble_candy', 'bubble_forest',
] as const;
export const STORE_CHAT_BACKGROUNDS = [
  'chatbg_stars', 'chatbg_waves', 'chatbg_geometric', 'chatbg_minimal',
  'chatbg_sunset', 'chatbg_aurora', 'chatbg_hearts', 'chatbg_space', 'chatbg_forest', 'chatbg_coffee',
] as const;

export type StoreCategory = 'frame' | 'badge' | 'theme' | 'chatBubble' | 'chatBackground';

export const STORE_ITEMS: { id: string; category: StoreCategory; priceCoins: number }[] = [
  ...STORE_FRAMES.map((id) => ({ id, category: 'frame' as const, priceCoins: 150 })),
  ...STORE_BADGES.map((id) => ({ id, category: 'badge' as const, priceCoins: 200 })),
  ...STORE_THEMES.map((id) => ({ id, category: 'theme' as const, priceCoins: 250 })),
  ...STORE_CHAT_BUBBLES.map((id) => ({ id, category: 'chatBubble' as const, priceCoins: 100 })),
  ...STORE_CHAT_BACKGROUNDS.map((id) => ({ id, category: 'chatBackground' as const, priceCoins: 150 })),
];
export const STORE_ITEM_IDS = STORE_ITEMS.map((i) => i.id) as [string, ...string[]];
