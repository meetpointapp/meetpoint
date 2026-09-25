import 'dart:math' show sqrt;

// Faz 16: "Kendini Keşfet" vibe sistemi. Soru/seçenek KİMLİKLERİ ve arketip vektörleri
// server/src/vibe.ts ile birebir aynı olmalı (puanlama sunucuda yapılır, burada sadece test
// akışını çizmek ve iki arketip arasındaki "uyum notu"nu istemci tarafında hesaplamak için
// kimlikler/vektörler tutulur). Metinler l10n'de (vibeQuestionLabel, vibeOptionLabel, vibeArchetypeName...).

class VibeQuestion {
  final String id;
  final List<String> optionIds;
  const VibeQuestion(this.id, this.optionIds);
}

const vibeQuestions = <VibeQuestion>[
  VibeQuestion('ideal_date', ['road_trip', 'cafe_chat', 'concert', 'candlelit_dinner']),
  VibeQuestion('flirt_style', ['direct', 'slow_burn', 'playful', 'deep_talk']),
  VibeQuestion('weekend', ['explore_new_place', 'stay_in', 'spontaneous_hangout', 'planned_activity']),
  VibeQuestion('communication', ['frequent_texts', 'rare_deep', 'voice_notes', 'plans_ahead']),
  VibeQuestion('conflict', ['talk_now', 'cool_off_first', 'bring_others', 'write_it_out']),
  VibeQuestion('dream_trip', ['backpacking', 'quiet_cabin', 'group_tour', 'romantic_getaway']),
  VibeQuestion('friday_night', ['new_experience', 'movie_at_home', 'party', 'one_on_one']),
  VibeQuestion('gift_style', ['surprise_adventure', 'practical', 'shared_experience', 'handwritten_note']),
  VibeQuestion('social_battery', ['crowd_energizes', 'small_group', 'one_friend', 'alone_time']),
  VibeQuestion('love_language', ['adventure_together', 'words', 'fun_together', 'reliability']),
];

// (macera, sosyal, spontane, romantik) — server/src/vibe.ts VIBE_ARCHETYPES ile aynı sırada.
const vibeArchetypeVectors = <String, List<int>>{
  'maceraci_romantik': [2, 0, 1, 2],
  'sakin_gozlemci': [-2, -1, -1, 0],
  'sosyal_kelebek': [1, 2, 1, 0],
  'pragmatik_planlayici': [-1, 0, -2, -1],
  'tutkulu_idealist': [0, 1, 0, 2],
  'ozgur_ruh': [2, 1, 2, 0],
  'sadik_yoldas': [-1, -1, -1, 1],
  'merakli_kasif': [2, 0, 2, -1],
  'duygusal_derinlik': [-1, -1, -1, 2],
  'eglence_duskunu': [1, 2, 2, 0],
  'sessiz_guc': [0, -2, -1, 1],
  'dengeli_ruh': [0, 0, 0, 0],
};

List<String> get vibeArchetypeIds => vibeArchetypeVectors.keys.toList();

enum VibeCompatTier { similar, complementary, opposite }

// server/src/vibe.ts compatibilityTier() ile aynı eşikler.
VibeCompatTier? vibeCompatibilityTier(String archetypeIdA, String archetypeIdB) {
  final a = vibeArchetypeVectors[archetypeIdA];
  final b = vibeArchetypeVectors[archetypeIdB];
  if (a == null || b == null) return null;
  var sumSq = 0;
  for (var i = 0; i < 4; i++) {
    final d = a[i] - b[i];
    sumSq += d * d;
  }
  final dist = sqrt(sumSq.toDouble());
  if (dist <= 2.5) return VibeCompatTier.similar;
  if (dist <= 4.5) return VibeCompatTier.complementary;
  return VibeCompatTier.opposite;
}
