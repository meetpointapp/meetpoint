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

const zodiacSymbol = <String, String>{
  'aries': '♈', 'taurus': '♉', 'gemini': '♊', 'cancer': '♋', 'leo': '♌', 'virgo': '♍',
  'libra': '♎', 'scorpio': '♏', 'sagittarius': '♐', 'capricorn': '♑', 'aquarius': '♒', 'pisces': '♓',
};

// Faz 20: müzik zevki (sunucu src/catalog.ts MUSIC_GENRES ile aynı kimlikler)
const musicEmoji = <String, String>{
  'pop': '🎤', 'rock': '🎸', 'rap': '🎧', 'electronic': '🎛️', 'jazz': '🎷', 'classical': '🎻',
  'arabesk': '🌙', 'turkish_folk': '🪕', 'turkish_pop': '💃', 'metal': '🤘', 'rnb': '🎹', 'indie': '🌿',
  'latin': '🪘', 'kpop': '✨', 'reggae': '🌴', 'blues': '🎺',
};
List<String> get musicGenreIds => musicEmoji.keys.toList();
const maxMusicGenres = 4;

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
  'frame_rainbow': [Color(0xFFFF4D6D), Color(0xFFF5A524), Color(0xFF2BD47D), Color(0xFF2F80ED), Color(0xFFA855F7)],
  'frame_fire': [Color(0xFFFF4500), Color(0xFFFFC107)],
};
List<String> get storeFrameIds => storeFrameGradient.keys.toList();
List<Color> storeFrameGradientOf(String id) => storeFrameGradient[id] ?? const [Colors.transparent, Colors.transparent];

// Rozet: isim yanında küçük bir emoji
const storeBadgeEmoji = <String, String>{
  'badge_crown': '👑',
  'badge_fire': '🔥',
  'badge_diamond': '💎',
  'badge_heart': '💖',
  'badge_star': '⭐',
  'badge_rocket': '🚀',
  'badge_cat': '🐱',
  'badge_music': '🎵',
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

// Sohbet baloncuğu stili: gradyan renkleri + yazı rengi (sadece sahibinin kendi sohbet görünümünü etkiler)
class ChatBubbleStyle {
  final List<Color> colors;
  final Color text;
  const ChatBubbleStyle(this.colors, {this.text = Colors.white});
  LinearGradient get gradient => LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: colors);
}

const storeChatBubbleStyle = <String, ChatBubbleStyle>{
  'bubble_midnight': ChatBubbleStyle([Color(0xFF1B1B3A), Color(0xFF3B3B80)]),
  'bubble_sunset': ChatBubbleStyle([Color(0xFFFF7E5F), Color(0xFFFEB47B)]),
  'bubble_mint': ChatBubbleStyle([Color(0xFF3EB489), Color(0xFF7DDCB5)]),
  'bubble_rosegold': ChatBubbleStyle([Color(0xFFB76E79), Color(0xFFE8B4B8)]),
  'bubble_ocean': ChatBubbleStyle([Color(0xFF0EA5E9), Color(0xFF2563EB)]),
  'bubble_neon': ChatBubbleStyle([Color(0xFFA855F7), Color(0xFFEC4899)]),
  'bubble_aurora': ChatBubbleStyle([Color(0xFF22D3EE), Color(0xFFA78BFA), Color(0xFFF472B6)]),
  'bubble_gold': ChatBubbleStyle([Color(0xFFFFD86B), Color(0xFFD99A0B)], text: Color(0xFF3B2A00)),
  'bubble_candy': ChatBubbleStyle([Color(0xFFFFB3D9), Color(0xFFFFD1E8)], text: Color(0xFF5A1F3F)),
  'bubble_forest': ChatBubbleStyle([Color(0xFF16A34A), Color(0xFF065F46)]),
};
List<String> get storeChatBubbleIds => storeChatBubbleStyle.keys.toList();
ChatBubbleStyle? storeChatBubbleStyleOf(String id) => storeChatBubbleStyle[id];
// Düz renk gereken yerler (seçim çipleri) için gradyanın ilk rengi
Map<String, Color> get storeChatBubbleColor => {for (final e in storeChatBubbleStyle.entries) e.key: e.value.colors.first};
Color? storeChatBubbleColorOf(String id) => storeChatBubbleStyle[id]?.colors.first;

// Sohbet arka planı: gradyan + isteğe bağlı sönük emoji deseni (sadece sahibinin kendi sohbet görünümünü etkiler)
class ChatBackdropStyle {
  final List<Color> colors;
  final String? pattern; // sönük, döşenmiş emoji
  final bool dark; // koyu zeminde karşı tarafın baloncuğu/yazısı açık tonlanır
  const ChatBackdropStyle(this.colors, {this.pattern, this.dark = false});
  LinearGradient get gradient => LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: colors);
}

const storeChatBackdropStyle = <String, ChatBackdropStyle>{
  'chatbg_stars': ChatBackdropStyle([Color(0xFF0B0C2A), Color(0xFF1B1F5A)], pattern: '✦', dark: true),
  'chatbg_waves': ChatBackdropStyle([Color(0xFFDCF3FA), Color(0xFFB6E3F2)], pattern: '〰️'),
  'chatbg_geometric': ChatBackdropStyle([Color(0xFFF5EDE6), Color(0xFFEADFD3)], pattern: '◆'),
  'chatbg_minimal': ChatBackdropStyle([Color(0xFFF7F7F7), Color(0xFFEFEFEF)]),
  'chatbg_sunset': ChatBackdropStyle([Color(0xFFFFE3D3), Color(0xFFFFB9A3), Color(0xFFF7A1C4)]),
  'chatbg_aurora': ChatBackdropStyle([Color(0xFF0F2027), Color(0xFF203A43), Color(0xFF2C5364)], pattern: '✧', dark: true),
  'chatbg_hearts': ChatBackdropStyle([Color(0xFFFFE4EC), Color(0xFFFFD0DF)], pattern: '♥'),
  'chatbg_space': ChatBackdropStyle([Color(0xFF05060F), Color(0xFF1A0B33)], pattern: '✶', dark: true),
  'chatbg_forest': ChatBackdropStyle([Color(0xFFE3F5E8), Color(0xFFC6EAD1)], pattern: '🌿'),
  'chatbg_coffee': ChatBackdropStyle([Color(0xFFFBF1E4), Color(0xFFEBD5B8)], pattern: '☕'),
};
List<String> get storeChatBackgroundIds => storeChatBackdropStyle.keys.toList();
ChatBackdropStyle? storeChatBackdropStyleOf(String id) => storeChatBackdropStyle[id];
Map<String, Color> get storeChatBackgroundColor => {for (final e in storeChatBackdropStyle.entries) e.key: e.value.colors.first};
Color? storeChatBackgroundColorOf(String id) => storeChatBackdropStyle[id]?.colors.first;

// Faz 17: "Sosyal cesaret yolculuğu" — her kademede açılan ücretsiz kozmetik ödül. Kimlikler
// server/src/achievements.ts MILESTONE_REWARD ile birebir eşleşmeli; görseli yukarıdaki store*
// haritalarından (aynı kataloğun kendi rengi/emoji'si) alınır.
const milestoneRewardId = <String, String>{
  'first_message': 'bubble_mint',
  'week_long_chat': 'chatbg_minimal',
  'first_icebreaker': 'bubble_sunset',
  'first_match': 'frame_gold',
  'first_gift': 'badge_heart',
  'first_call': 'bubble_neon',
  'profile_complete': 'theme_royal',
  'verified': 'badge_diamond',
  'vibe_done': 'theme_galaxy',
  'first_earning': 'badge_crown',
  'earning_50usd': 'frame_stars',
  'earning_100usd': 'frame_rainbow',
};

Color milestoneRewardColorOf(String milestoneId) {
  final id = milestoneRewardId[milestoneId];
  return storePremiumThemeAccent[id] ??
      storeChatBubbleColor[id] ??
      storeChatBackgroundColor[id] ??
      (storeFrameGradient[id]?.first) ??
      const Color(0xFFF5A524);
}

String milestoneRewardEmojiOf(String milestoneId) {
  final id = milestoneRewardId[milestoneId] ?? '';
  return storeBadgeEmoji[id] ?? '';
}

// Faz 17: sohbet içi buz kırıcı — "bu mu o mu" katalogu. Kimlikler server/src/catalog.ts
// THIS_OR_THAT_PROMPTS ile birebir eşleşmeli; A/B seçenek metinleri l10n'de (thisOrThatOptionA/B).
const thisOrThatPromptIds = [
  'sea_or_mountain', 'coffee_or_tea', 'morning_or_night', 'city_or_nature',
  'book_or_movie', 'summer_or_winter', 'planned_or_spontaneous', 'home_or_travel',
];
