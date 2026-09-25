// Profil kataloğu. Kimlikler sunucudaki server/src/catalog.ts ile aynı olmalı;
// çeviriler l10n dosyalarındaki select mesajlarında (interestLabel vb.).
import 'package:flutter/material.dart';

const interestEmoji = <String, String>{
  'coffee': '☕', 'travel': '✈️', 'music': '🎵', 'concerts': '🎤', 'movies': '🎬',
  'series': '📺', 'books': '📚', 'photography': '📷', 'art': '🎨', 'cooking': '🍳',
  'foodie': '🍜', 'wine': '🍷', 'fitness': '💪', 'yoga': '🧘', 'running': '🏃',
  'cycling': '🚴', 'hiking': '🥾', 'camping': '🏕️', 'football': '⚽', 'basketball': '🏀',
  'gaming': '🎮', 'tech': '💻', 'fashion': '👗', 'dancing': '💃', 'pets': '🐾',
  'nature': '🌿', 'beach': '🏖️', 'meditation': '🕯️', 'anime': '🍥', 'volunteering': '🤝',
};

List<String> get interestIds => interestEmoji.keys.toList();

const promptIds = [
  'perfect_sunday', 'laugh', 'green_flag', 'travel_dream', 'unpopular_opinion',
  'simple_pleasures', 'looking_for', 'two_truths', 'first_date', 'song',
];

const lookingForEmoji = <String, String>{
  'relationship': '💞',
  'casual': '🥂',
  'friendship': '👋',
  'chat': '💬',
  'unsure': '🤔',
};

const educationIds = ['high_school', 'bachelor', 'master', 'phd'];
const habitIds = ['no', 'sometimes', 'yes'];
const zodiacIds = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const minInterests = 3;
const maxInterests = 5;
const maxPrompts = 3;
const promptMaxLength = 200;

// Faz 16: kişisel profil vitrini. '' = varsayılan marka rengi/zemini (uygulama genelindeki
// gradyanla aynı), o yüzden bu haritalarda ayrı bir '' girişi yok — boş kimlik varsayılanı işaretler.
const themeAccent = <String, Color>{
  'coral': Color(0xFFFF4D6D),
  'ocean': Color(0xFF0EA5E9),
  'sunset': Color(0xFFF97316),
  'forest': Color(0xFF22C55E),
  'lavender': Color(0xFFA78BFA),
  'rose': Color(0xFFEC4899),
};
List<String> get themeIds => themeAccent.keys.toList();

const cardBackgroundGradient = <String, List<Color>>{
  'default': [Color(0xFFFF4D6D), Color(0xFFFF8A5B)],
  'ocean': [Color(0xFF0EA5E9), Color(0xFF14B8A6)],
  'sunset': [Color(0xFFF97316), Color(0xFFEC4899)],
  'forest': [Color(0xFF16A34A), Color(0xFF14B8A6)],
  'lavender': [Color(0xFFA78BFA), Color(0xFFEC4899)],
  'midnight': [Color(0xFF1E293B), Color(0xFF4338CA)],
};
List<String> get cardBackgroundIds => cardBackgroundGradient.keys.toList();

Color themeColorOf(String id) => themeAccent[id] ?? themeAccent['coral']!;
List<Color> cardGradientOf(String id) => cardBackgroundGradient[id] ?? cardBackgroundGradient['default']!;

// Faz 16: çizgi avatar. Basit katmanlı şekillerle çizilir (varlık/görsel dosyası gerekmez).
const avatarSkinColor = <String, Color>{
  'light': Color(0xFFFFE0BD),
  'medium': Color(0xFFF1C27D),
  'tan': Color(0xFFE0AC69),
  'brown': Color(0xFFC68642),
  'dark': Color(0xFF8D5524),
};
List<String> get avatarSkinIds => avatarSkinColor.keys.toList();

const avatarHairStyles = ['bald', 'short', 'long', 'curly'];
const avatarHairColor = <String, Color>{
  'black': Color(0xFF2B2118),
  'brown': Color(0xFF6B4226),
  'blonde': Color(0xFFE8C275),
  'red': Color(0xFFB5502C),
  'gray': Color(0xFFB0B0B0),
};
List<String> get avatarHairColorIds => avatarHairColor.keys.toList();

// Kıyafet renkleri tema paletiyle aynı (tutarlı görünüm)
Color avatarOutfitColorOf(String id) => storeAvatarOutfitColor[id] ?? themeColorOf(id);
List<String> get avatarOutfitIds => themeIds;

const avatarAccessoryEmoji = <String, String>{'none': '', 'glasses': '👓', 'hat': '🎩', 'headphones': '🎧'};
List<String> get avatarAccessoryIds => avatarAccessoryEmoji.keys.toList();

// Faz 16: kendi oda. Statik yerleşim; her eşya sabit bir ızgara hücresine yerleştirilir.
const roomGridW = 4;
const roomGridH = 5;
const roomMaxItems = 12;

const roomWallpaperColor = <String, Color>{
  'plain': Color(0xFFF5EDE6),
  'coral': Color(0xFFFFE1E8),
  'ocean': Color(0xFFDCF3FA),
  'sunset': Color(0xFFFFE7D6),
  'forest': Color(0xFFE1F5EA),
  'lavender': Color(0xFFEEE6FB),
};
List<String> get roomWallpaperIds => roomWallpaperColor.keys.toList();
Color roomWallpaperColorOf(String id) => roomWallpaperColor[id] ?? roomWallpaperColor['plain']!;

const roomFloorColor = <String, Color>{
  'wood': Color(0xFFC8935B),
  'tile': Color(0xFFD9D2C7),
  'coral': Color(0xFFF6B8B8),
  'ocean': Color(0xFFA9D8E8),
};
List<String> get roomFloorIds => roomFloorColor.keys.toList();
Color roomFloorColorOf(String id) => roomFloorColor[id] ?? roomFloorColor['wood']!;

const roomItemEmoji = <String, String>{
  'sofa': '🛋️',
  'bed': '🛏️',
  'plant': '🪴',
  'lamp': '💡',
  'tv': '📺',
  'bookshelf': '📚',
  'table': '🪑',
  'rug': '🧺',
  'window': '🪟',
  'picture': '🖼️',
};
List<String> get roomItemIds => roomItemEmoji.keys.toList();

// Faz 16: günlük ruh hali. Serbest metin yok, sadece küçük bir katalog; 24 saatte kaybolur.
const moodEmoji = <String, String>{
  'happy': '😊',
  'excited': '🤩',
  'relaxed': '😌',
  'romantic': '🥰',
  'tired': '😴',
  'stressed': '😣',
  'grateful': '🙏',
  'adventurous': '🤠',
  'lonely': '🥺',
  'busy': '🏃',
  'hopeful': '🌱',
  'bored': '🥱',
};
List<String> get moodIds => moodEmoji.keys.toList();

// Faz 16: kozmetik mağaza. Kimlikler server/src/catalog.ts STORE_* ile birebir aynı olmalı.
// Fiyatlar sunucudan (/store/items) gelir — burada sadece görsel tasarım (renk/emoji) var.

// Çerçeve: profil fotoğrafının etrafında renkli/gradyanlı bir halka
const storeFrameGradient = <String, List<Color>>{
  'frame_gold': [Color(0xFFFFD700), Color(0xFFB8860B)],
  'frame_neon': [Color(0xFF00F5FF), Color(0xFFFF00E5)],
  'frame_floral': [Color(0xFFFFB6D9), Color(0xFF7ED957)],
  'frame_stars': [Color(0xFF4B0082), Color(0xFF9370DB)],
};
List<String> get storeFrameIds => storeFrameGradient.keys.toList();
List<Color> storeFrameGradientOf(String id) => storeFrameGradient[id] ?? const [Colors.transparent, Colors.transparent];

// Rozet: isim yanında küçük bir emoji
const storeBadgeEmoji = <String, String>{
  'badge_crown': '👑',
  'badge_fire': '🔥',
  'badge_diamond': '💎',
  'badge_heart': '💖',
};
List<String> get storeBadgeIds => storeBadgeEmoji.keys.toList();

// Premium temalar: themeId alanına eklenir, themeColorOf/cardGradientOf ile aynı şekilde kullanılır
const storePremiumThemeAccent = <String, Color>{
  'theme_galaxy': Color(0xFF6A0DAD),
  'theme_fire': Color(0xFFFF4500),
  'theme_ice': Color(0xFF7FDBFF),
  'theme_royal': Color(0xFFB8860B),
};
List<String> get storeThemeIds => storePremiumThemeAccent.keys.toList();

// Premium oda mobilyaları: roomItemEmoji ile aynı harita mantığı, ayrı bir katalog
const storeRoomItemEmoji = <String, String>{
  'item_piano': '🎹',
  'item_aquarium': '🐠',
  'item_chandelier': '🕯️',
  'item_arcade': '🕹️',
};
List<String> get storeRoomItemIds => storeRoomItemEmoji.keys.toList();
String roomItemEmojiOf(String id) => roomItemEmoji[id] ?? storeRoomItemEmoji[id] ?? '';

// Premium avatar kıyafetleri: avatarOutfitColorOf ile aynı mantık, ayrı bir katalog
const storeAvatarOutfitColor = <String, Color>{
  'outfit_tuxedo': Color(0xFF1A1A1A),
  'outfit_superhero': Color(0xFFDC143C),
  'outfit_wizard': Color(0xFF4B0082),
  'outfit_astronaut': Color(0xFFC0C0C0),
};
List<String> get storeAvatarOutfitIds => storeAvatarOutfitColor.keys.toList();

// Sohbet baloncuğu rengi (sadece sahibinin kendi sohbet görünümünü etkiler)
const storeChatBubbleColor = <String, Color>{
  'bubble_midnight': Color(0xFF1B1B3A),
  'bubble_sunset': Color(0xFFFF7E5F),
  'bubble_mint': Color(0xFF3EB489),
  'bubble_rosegold': Color(0xFFB76E79),
};
List<String> get storeChatBubbleIds => storeChatBubbleColor.keys.toList();
Color? storeChatBubbleColorOf(String id) => storeChatBubbleColor[id];

// Sohbet arka planı (sadece sahibinin kendi sohbet görünümünü etkiler)
const storeChatBackgroundColor = <String, Color>{
  'chatbg_stars': Color(0xFF0B0C2A),
  'chatbg_waves': Color(0xFFDCF3FA),
  'chatbg_geometric': Color(0xFFF5EDE6),
  'chatbg_minimal': Color(0xFFF7F7F7),
};
List<String> get storeChatBackgroundIds => storeChatBackgroundColor.keys.toList();
Color? storeChatBackgroundColorOf(String id) => storeChatBackgroundColor[id];
