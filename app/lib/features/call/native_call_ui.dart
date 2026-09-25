import 'package:flutter/foundation.dart';
import 'package:flutter_callkit_incoming/entities/entities.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';

// Faz 15 · yerel gelen arama ekranı. Uygulama kapalıyken/arka plandayken gelen aramayı, işletim
// sisteminin kendi tam ekran arama arayüzüyle (Android: özel tam ekran bildirim, iOS: CallKit)
// gösterir. Ön plandayken uygulama zaten kendi çalma ekranını gösterdiği için burası SADECE
// arka plan/kapalı durumda (FCM veri mesajı veya PushKit) çağrılır.
//
// callId, sunucudaki Call.id'dir: kabul/ret bu id ile sunucuya bildirilir, kullanıcı uygulamayı
// açınca aynı id'yle /call/:id ekranı açılır.
Future<void> showIncomingCallUi({
  required String callId,
  required String callerName,
  String? avatarUrl,
  required bool isVideo,
}) async {
  try {
    await FlutterCallkitIncoming.showCallkitIncoming(CallKitParams(
      id: callId,
      nameCaller: callerName,
      appName: 'MeetPoint',
      avatar: avatarUrl,
      handle: callerName,
      type: isVideo ? 1 : 0,
      duration: 45000, // sunucudaki CALL_RING_SECONDS ile aynı büyüklükte (varsayılan 45 sn)
      android: const AndroidParams(
        isShowLogo: false,
        ringtonePath: 'system_ringtone_default',
        incomingCallNotificationChannelName: 'Gelen arama',
        missedCallNotificationChannelName: 'Cevapsız arama',
        isShowCallID: false,
        textAccept: 'Kabul et',
        textDecline: 'Reddet',
      ),
      ios: const IOSParams(handleType: 'generic', supportsVideo: true, ringtonePath: 'system_ringtone_default'),
    ));
  } catch (e) {
    debugPrint('showIncomingCallUi failed: $e');
  }
}

// Arama başka şekilde sonlandığında (kabul edilip uygulama açıldığında, karşı taraf kapattığında,
// zaman aşımına uğradığında) yerel arama arayüzü/bildirimi temizlenir.
Future<void> endNativeCallUi(String callId) async {
  try {
    await FlutterCallkitIncoming.endCall(callId);
  } catch (_) {}
}
