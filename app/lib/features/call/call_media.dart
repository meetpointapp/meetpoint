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
  Future<void> dispose() async => remoteJoined.dispose();
  @override
  Widget? remoteView() => null;
  @override
  Widget? localView() => null;
}

// Web ve diğer desteklenmeyen platformlar impl.createMediaEngine'den bunu döndürür
CallMediaEngine simulatedMediaEngine() => _SimulatedMedia();
