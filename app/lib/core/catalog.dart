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
