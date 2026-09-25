import 'package:flutter/widgets.dart';

import '../../core/models.dart';
import 'call_media_stub.dart' if (dart.library.io) 'call_media_agora.dart' as impl;

// Arama sırasında ses/görüntü aktarımı. Mobilde Agora; web'de veya sunucu Agora
// anahtarı vermediyse (media == null) simülasyon: akış ve ücretlendirme gerçek,
// ama ses/görüntü aktarılmaz.
abstract class CallMediaEngine {
  // true: gerçek ses/görüntü var · false: simülasyon
  bool get isReal;

  // Karşı taraf kanala katıldı mı (görüntüsü hazır mı)
  ValueNotifier<bool> get remoteJoined;

  // Kendi tarafımız Agora kanalına gerçekten katıldı mı (Faz 15: adil ücretlendirme sunucuya bununla
  // bildirilir). Simülasyonda start() dönünce anında tamamlanır.
  Future<void> get joined;

  // Faz 15: uzun ve kesintisiz aramalar. Jeton süresi dolmadan (~30 sn kala) tetiklenir; dinleyen
  // taraf yeni jeton alıp renewToken'a vermeli. Simülasyonda hiç tetiklenmez.
  Stream<void> get tokenExpiring;
  Future<void> renewToken(String token);

  // Bağlantı kalitesi zayıf mı (kullanıcıya uyarı göstermek için). Simülasyonda hep iyi.
  ValueNotifier<bool> get weakConnection;

  Future<void> start({required CallMedia? media, required bool video});
  Future<void> setMuted(bool muted);
  Future<void> setCameraOn(bool on);
  Future<void> switchCamera();
  Future<void> setSpeaker(bool on);
  Future<void> dispose();

  // Görüntülü aramada karşı tarafın ve kendi kameranın görünümü (simülasyonda null)
  Widget? remoteView();
  Widget? localView();

  factory CallMediaEngine(CallMedia? media) =>
      media == null ? _SimulatedMedia() : impl.createMediaEngine();
}

class _SimulatedMedia implements CallMediaEngine {
  @override
  final remoteJoined = ValueNotifier(true);
  @override
  bool get isReal => false;
  @override
  Future<void> get joined => Future.value();
  @override
  Stream<void> get tokenExpiring => const Stream.empty();
  @override
  Future<void> renewToken(String token) async {}
  @override
  final weakConnection = ValueNotifier(false);
  @override
  Future<void> start({required CallMedia? media, required bool video}) async {}
  @override
  Future<void> setMuted(bool muted) async {}
  @override
  Future<void> setCameraOn(bool on) async {}
  @override
  Future<void> switchCamera() async {}
  @override
  Future<void> setSpeaker(bool on) async {}
  @override
  Future<void> dispose() async {
    remoteJoined.dispose();
    weakConnection.dispose();
  }
  @override
  Widget? remoteView() => null;
  @override
  Widget? localView() => null;
}

// Web ve diğer desteklenmeyen platformlar impl.createMediaEngine'den bunu döndürür
CallMediaEngine simulatedMediaEngine() => _SimulatedMedia();
