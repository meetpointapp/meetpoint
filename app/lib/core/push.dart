import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../firebase_options.dart';
import 'api.dart';

// Push bildirimleri (FCM). Firebase yapılandırılmamışsa sessizce devre dışı kalır.
class Push {
  Push._();
  static final instance = Push._();

  bool _ready = false;
  String? token;

  String get _platform => kIsWeb
      ? 'web'
      : switch (defaultTargetPlatform) {
          TargetPlatform.iOS => 'ios',
          _ => 'android',
        };

  bool _openHandlerSet = false;

  // Girişten sonra çağrılır: izin iste, cihaz jetonunu sunucuya kaydet. onOpen: kullanıcı bir
  // bildirime dokununca (uygulama arka plandaydı ya da kapalıydı) sunucunun hesapladığı ekrana
  // gitmek için çağrılır (Faz 15: push güvenilirliği · derin bağlantı).
  Future<void> register(Api api, {void Function(String route)? onOpen}) async {
    try {
      if (!_ready) {
        await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
        _ready = true;
      }
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;
      token = await messaging.getToken();
      if (token != null) await api.registerDevice(token!, _platform);
      messaging.onTokenRefresh.listen((t) {
        token = t;
        api.registerDevice(t, _platform).catchError((_) {});
      });
      if (onOpen != null && !_openHandlerSet) {
        _openHandlerSet = true;
        void handle(RemoteMessage? m) {
          final route = m?.data['route'];
          if (route is String && route.isNotEmpty) onOpen(route);
        }

        FirebaseMessaging.onMessageOpenedApp.listen(handle);
        handle(await messaging.getInitialMessage()); // uygulama bildirime dokunularak açıldıysa
      }
    } catch (e) {
      // Firebase ayarlı değil veya izin yok: uygulama bildirimsiz çalışmaya devam eder
      debugPrint('push disabled: $e');
    }
  }

  // Çıkışta bu cihaza başka hesabın bildirimleri gelmesin
  Future<void> unregister(Api api) async {
    final t = token;
    if (t == null) return;
    await api.unregisterDevice(t).catchError((_) {});
    token = null;
  }
}
