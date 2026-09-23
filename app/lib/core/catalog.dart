// Profil kataloğu. Kimlikler sunucudaki server/src/catalog.ts ile aynı olmalı;
// çeviriler l10n dosyalarındaki select mesajlarında (interestLabel vb.).

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
