import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';

// Faz 16: cilalı mikro-etkileşimler — haptik geri bildirim + kısa ses efektleri. Sesler sadece
// anlamlı, seyrek anlarda çalar (kaydırma gibi sık tekrarlanan eylemlerde sadece haptik vardır,
// yoksa ses yorucu olur). Her çağrı best-effort: platform desteklemiyorsa (web ses politikası,
// izin yok, test ortamı) sessizce yutulur — bu bir cila katmanı, hiçbir akışı bloklamamalı.
abstract final class Fx {
  // Oynatıcı ilk kullanımda (tembel) ve korumalı bölgede oluşturulur: eklenti yoksa (test, bazı platformlar)
  // yapıcının asenkron başlatma hatası uygulamayı/testi düşürmez.
  static AudioPlayer? _player;

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

  // Faz 24: frekans yakalama kademeleri (1 merak, 2 ilgi, 3 tutku) — her kademede daha güçlü titreşim
  static void captureTier(int tier) {
    try {
      switch (tier) {
        case 1:
          HapticFeedback.selectionClick();
        case 2:
          HapticFeedback.mediumImpact();
        default:
          HapticFeedback.heavyImpact();
      }
    } catch (_) {}
  }

  // En yüksek değerli an: eşleşme, kademe atlama — güçlü haptik + kutlama sesi
  static void celebrate() {
    try {
      HapticFeedback.heavyImpact();
    } catch (_) {}
    _play('celebrate.wav');
  }

  // Faz 24: eşleşmenin imza haptiği — iki frekans yaklaşırken hafif, birleşince sert vuruş
  static Future<void> frequencySync() async {
    try {
      await HapticFeedback.mediumImpact();
      await Future<void>.delayed(const Duration(milliseconds: 380));
      await HapticFeedback.lightImpact();
      await Future<void>.delayed(const Duration(milliseconds: 140));
      await HapticFeedback.heavyImpact();
    } catch (_) {}
    _play('celebrate.wav');
  }

  static Future<void> _play(String asset) async {
    await runZonedGuarded(() async {
      try {
        final player = _player ??= AudioPlayer()..setPlayerMode(PlayerMode.lowLatency);
        await player.stop();
        await player.play(AssetSource('sfx/$asset'));
      } catch (_) {
        // Ses çalınamadı (izin/politika/test ortamı) — sessizce yut
      }
    }, (_, _) {});
  }
}
