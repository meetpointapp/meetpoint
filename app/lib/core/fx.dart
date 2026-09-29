import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';

// Faz 16: cilalı mikro-etkileşimler — haptik geri bildirim + kısa ses efektleri. Sesler sadece
// anlamlı, seyrek anlarda çalar (kaydırma gibi sık tekrarlanan eylemlerde sadece haptik vardır,
// yoksa ses yorucu olur). Her çağrı best-effort: platform desteklemiyorsa (web ses politikası,
// izin yok, test ortamı) sessizce yutulur — bu bir cila katmanı, hiçbir akışı bloklamamalı.
abstract final class Fx {
  static final _player = AudioPlayer()..setPlayerMode(PlayerMode.lowLatency);

  // Sık tekrarlanan dokunuşlar: buton, kaydırma, geç/beğen — sadece haptik
  static void tap() {
    try {
      HapticFeedback.selectionClick();
    } catch (_) {}
  }

  // Seyrek ama anlamlı onaylar: satın alma, kilit açma, abonelik — haptik + kısa ses
  static void success() {
    try {
      HapticFeedback.mediumImpact();
    } catch (_) {}
    _play('success.wav');
  }

  // En yüksek değerli an: eşleşme, kademe atlama — güçlü haptik + kutlama sesi
  static void celebrate() {
    try {
      HapticFeedback.heavyImpact();
    } catch (_) {}
    _play('celebrate.wav');
  }

  static Future<void> _play(String asset) async {
    try {
      await _player.stop();
      await _player.play(AssetSource('sfx/$asset'));
    } catch (_) {
      // Ses çalınamadı (izin/politika/test ortamı) — sessizce yut
    }
  }
}
