import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'config.dart';
import 'models.dart';
import 'session.dart';

final meProvider = FutureProvider<Me>((ref) => ref.watch(apiProvider).me());

final walletProvider = FutureProvider<WalletInfo>((ref) => ref.watch(apiProvider).wallet());

final conversationsProvider = FutureProvider<List<Conversation>>((ref) => ref.watch(apiProvider).conversations());

final requestsProvider = FutureProvider.family<List<ContactRequest>, bool>(
  (ref, inbox) => ref.watch(apiProvider).requests(inbox: inbox),
);

final userProvider = FutureProvider.autoDispose.family<PublicProfile, String>(
  (ref, id) => ref.watch(apiProvider).user(id),
);

final payoutsProvider = FutureProvider.autoDispose<List<Payout>>((ref) => ref.watch(apiProvider).payouts());

final callHistoryProvider = FutureProvider.autoDispose<List<CallInfo>>((ref) => ref.watch(apiProvider).calls());

final likesProvider = FutureProvider<LikesInfo>((ref) => ref.watch(apiProvider).likes());

// Okunmamış toplam mesaj sayısı (alt menü rozeti için)
final unreadCountProvider = Provider<int>((ref) =>
    ref.watch(conversationsProvider).value?.fold<int>(0, (sum, c) => sum + c.unreadCount) ?? 0);

class RealtimeEvent {
  final String name;
  final dynamic data;
  const RealtimeEvent(this.name, this.data);
}

// Sunucuyla anlık bağlantı (Socket.IO): olayları dinler, "yazıyor" gibi sinyaller gönderir
class Realtime {
  Realtime._(this._socket, this._controller);

  final io.Socket? _socket;
  final StreamController<RealtimeEvent> _controller;

  Stream<RealtimeEvent> get events => _controller.stream;

  void emit(String event, Map<String, dynamic> data) => _socket?.emit(event, data);
}

const _events = [
  'match',
  'superlike',
  'request:new',
  'request:updated',
  'message:new',
  'message:read',
  'message:viewed',
  'typing',
  'wallet:updated',
  'call:incoming',
  'call:accepted',
  'call:charged',
  'call:low_balance',
  'call:gift',
  'call:ended',
];

// Oturum değişince bağlantı yenilenir
final realtimeProvider = Provider<Realtime>((ref) {
  final token = ref.watch(sessionProvider.select((s) => s.value?.token));
  final controller = StreamController<RealtimeEvent>.broadcast();
  ref.onDispose(controller.close);
  if (token == null) return Realtime._(null, controller);

  final socket = io.io(
    apiBaseUrl,
    io.OptionBuilder().setTransports(['websocket']).setAuth({'token': token}).enableForceNew().build(),
  );
  for (final name in _events) {
    socket.on(name, (data) {
      if (!controller.isClosed) controller.add(RealtimeEvent(name, data));
    });
  }
  ref.onDispose(socket.dispose);
  return Realtime._(socket, controller);
});
