import 'models.dart';

// Profil tamamlama yüzdesi: fotoğraf, soru ve temel bilgiler eşleşmeyi artırır.
// Sunucu keşfette bio + 3 ilgi alanı + 3 fotoğrafı olan profilleri öne alır (routes/discover.ts "complete").
int profileCompletion(PublicProfile p) {
  var score = 0;
  score += (p.photos.length.clamp(0, 3)) * 10; // 30
  if (p.interests.length >= 3) score += 10;
  if (p.lookingFor.isNotEmpty) score += 10;
  score += p.prompts.length.clamp(0, 3) * 10; // 30
  if (p.bio.isNotEmpty) score += 10;
  if (_basics(p) >= 2) score += 10;
  return score.clamp(0, 100);
}

int _basics(PublicProfile p) => [
      p.heightCm != null,
      p.job.isNotEmpty,
      p.education.isNotEmpty,
      p.zodiac.isNotEmpty,
      p.city.isNotEmpty,
    ].where((b) => b).length;

// Eksik adımlar: (anahtar, kaç tane eksik). Her biri %10 puan.
enum MissingStep { photos, interests, lookingFor, prompts, bio, basics }

List<(MissingStep, int)> profileMissing(PublicProfile p) => [
      if (p.photos.length < 3) (MissingStep.photos, 3 - p.photos.length),
      if (p.interests.length < 3) (MissingStep.interests, 3 - p.interests.length),
      if (p.lookingFor.isEmpty) (MissingStep.lookingFor, 1),
      if (p.prompts.length < 3) (MissingStep.prompts, 3 - p.prompts.length),
      if (p.bio.isEmpty) (MissingStep.bio, 1),
      if (_basics(p) < 2) (MissingStep.basics, 1),
    ];
