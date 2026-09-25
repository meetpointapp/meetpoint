import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_callkit_incoming/entities/entities.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';

import '../features/call/native_call_ui.dart';
import '../firebase_options.dart';
import 'api.dart';

// FCM arka plan işleyicisi: ayrı bir izole (isolate) üzerinde çalışır, ana uygulama durumuna
// erişemez, bu yüzden kendi Firebase başlatmasını yapar. main()'de en başta (runApp'ten önce)
// kaydedilmelidir. Uygulama kapalıyken/arka plandayken gelen arama verisi burada yakalanıp yerel
// tam ekran arama arayüzü gösterilir (Faz 15: Android'de bu yol, iOS'ta ayrıca PushKit kullanılır
// çünkü iOS arka plan veri mesajlarıyla kapalı uygulamayı güvenilir şekilde uyandırmaz).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  final callId = message.data['callId'] as String?;
  if (message.data['kind'] != 'call' || callId == null || callId.isEmpty) return;
  try {
    if (Firebase.apps.isEmpty) await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    await showIncomingCallUi(
      callId: callId,
      callerName: message.data['callerName'] as String? ?? 'MeetPoint',
      isVideo: message.data['callKind'] == 'VIDEO',
    );
  } catch (e) {
    debugPrint('background call push failed: $e');
  }
}

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
        // main()'de arka plan işleyicisi için zaten başlatılmış olabilir (varsayılan app tekil)
        if (Firebase.apps.isEmpty) await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
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
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) await _registerVoip(api);
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) await _prepareAndroidCallUi();
  }

  // Android 13+ bildirim izni, Android 14+ tam ekran arama izni (Faz 15: yerel gelen arama ekranı)
  Future<void> _prepareAndroidCallUi() async {
    try {
      await FlutterCallkitIncoming.requestNotificationPermission({
        'title': 'Bildirim izni',
        'rationaleMessagePermission': 'Gelen aramaları görebilmen için bildirim izni gerekiyor.',
        'postNotificationMessageRequired': 'Bildirim izni gerekiyor, lütfen ayarlardan izin ver.',
      });
      if (!(await FlutterCallkitIncoming.canUseFullScreenIntent())) {
        await FlutterCallkitIncoming.requestFullIntentPermission();
      }
    } catch (e) {
      debugPrint('android call ui permission failed: $e');
    }
  }

  bool _voipHandlerSet = false;

  // iOS: CallKit'i uyandıran PushKit jetonu (normal FCM jetonundan ayrı). Sunucu ayarlı değilse
  // (APNS_* boşsa) bu jeton sessizce kullanılmaz (bkz. server/src/voip.ts).
  Future<void> _registerVoip(Api api) async {
    try {
      final voipToken = await FlutterCallkitIncoming.getDevicePushTokenVoIP();
      if (voipToken is String && voipToken.isNotEmpty) await api.registerDevice(voipToken, 'ios-voip');
      if (!_voipHandlerSet) {
        _voipHandlerSet = true;
        FlutterCallkitIncoming.onEvent.listen((event) async {
          if (event is! CallEventActionDidUpdateDevicePushTokenVoip) return;
          final t = await FlutterCallkitIncoming.getDevicePushTokenVoIP();
          if (t != null && t.isNotEmpty) api.registerDevice(t, 'ios-voip').catchError((_) {});
        });
      }
    } catch (e) {
      debugPrint('voip token registration failed: $e');
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
