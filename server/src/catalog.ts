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

// Faz 16: kozmetik mağaza. Jetonla alınan, ücretsiz kataloglara ek premium seçenekler. Bu jetonlar
// kullanıcıdan kullanıcıya geçmez (hepsi platform geliri). Renk/görsel tasarımı app/lib/core/catalog.dart'ta.
export const STORE_FRAMES = ['frame_gold', 'frame_neon', 'frame_floral', 'frame_stars'] as const;
export const STORE_BADGES = ['badge_crown', 'badge_fire', 'badge_diamond', 'badge_heart'] as const;
// themeId alanına eklenen premium seçenekler (ücretsiz THEMES ile aynı alan, sahiplik gerekir)
export const STORE_THEMES = ['theme_galaxy', 'theme_fire', 'theme_ice', 'theme_royal'] as const;
// roomItems[].itemId'ye eklenen premium mobilyalar (ücretsiz ROOM_ITEMS ile aynı ızgara)
export const STORE_ROOM_ITEMS = ['item_piano', 'item_aquarium', 'item_chandelier', 'item_arcade'] as const;
// avatarOutfitId alanına eklenen premium kıyafetler
export const STORE_AVATAR_OUTFITS = ['outfit_tuxedo', 'outfit_superhero', 'outfit_wizard', 'outfit_astronaut'] as const;
// Sadece sahibinin kendi sohbet görünümünü etkiler (başkasına gösterilmez)
export const STORE_CHAT_BUBBLES = ['bubble_midnight', 'bubble_sunset', 'bubble_mint', 'bubble_rosegold'] as const;
export const STORE_CHAT_BACKGROUNDS = ['chatbg_stars', 'chatbg_waves', 'chatbg_geometric', 'chatbg_minimal'] as const;

export type StoreCategory = 'frame' | 'badge' | 'theme' | 'roomItem' | 'avatarOutfit' | 'chatBubble' | 'chatBackground';

export const STORE_ITEMS: { id: string; category: StoreCategory; priceCoins: number }[] = [
  ...STORE_FRAMES.map((id) => ({ id, category: 'frame' as const, priceCoins: 150 })),
  ...STORE_BADGES.map((id) => ({ id, category: 'badge' as const, priceCoins: 200 })),
  ...STORE_THEMES.map((id) => ({ id, category: 'theme' as const, priceCoins: 250 })),
  ...STORE_ROOM_ITEMS.map((id) => ({ id, category: 'roomItem' as const, priceCoins: 300 })),
  ...STORE_AVATAR_OUTFITS.map((id) => ({ id, category: 'avatarOutfit' as const, priceCoins: 300 })),
  ...STORE_CHAT_BUBBLES.map((id) => ({ id, category: 'chatBubble' as const, priceCoins: 100 })),
  ...STORE_CHAT_BACKGROUNDS.map((id) => ({ id, category: 'chatBackground' as const, priceCoins: 150 })),
];
export const STORE_ITEM_IDS = STORE_ITEMS.map((i) => i.id) as [string, ...string[]];
