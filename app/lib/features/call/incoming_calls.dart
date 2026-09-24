import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../router.dart';

// Gelen aramaları hangi ekranda olunursa olsun tam ekran açar.
// Uygulama bir arama bildirimiyle açıldıysa hâlâ çalan aramayı da gösterir.
final incomingCallsProvider = Provider<void>((ref) {
  final router = ref.watch(routerProvider);
  final auth = ref.watch(sessionProvider.select((s) => s.value?.auth));
  if (auth == null) return;

  void open(CallInfo call) {
    if (router.routerDelegate.currentConfiguration.uri.path.startsWith('/call/')) return;
    router.push('/call/${call.id}', extra: call);
  }

  final sub = ref.watch(realtimeProvider).events.where((e) => e.name == 'call:incoming').listen((e) {
    open(CallInfo.fromJson(Map<String, dynamic>.from(e.data as Map)));
  });
  ref.onDispose(sub.cancel);

  ref.read(apiProvider).calls().then((calls) {
    final ringing = calls.where((c) => !c.outgoing && c.status == CallStatus.ringing).firstOrNull;
    if (ringing != null) open(ringing);
  }, onError: (_) {});
});
