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
Color avatarOutfitColorOf(String id) => themeColorOf(id);
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
