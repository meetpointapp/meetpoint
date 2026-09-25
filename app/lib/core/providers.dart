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

// Faz 16: ziyaret edilen odayı gösterir; bağlantı yoksa sunucu 403 not_connected döner.
final userRoomProvider = FutureProvider.autoDispose.family<RoomInfo, String>(
  (ref, id) => ref.watch(apiProvider).userRoom(id),
);

final payoutsProvider = FutureProvider.autoDispose<List<Payout>>((ref) => ref.watch(apiProvider).payouts());

final callHistoryProvider = FutureProvider.autoDispose<List<CallInfo>>((ref) => ref.watch(apiProvider).calls());

final likesProvider = FutureProvider<LikesInfo>((ref) => ref.watch(apiProvider).likes());

// Faz 16: ilgi alanı bazlı keşif — gruplar ve bir grubun üyeleri
final interestGroupsProvider = FutureProvider.autoDispose<List<InterestGroup>>((ref) => ref.watch(apiProvider).discoverGroups());
final interestGroupMembersProvider = FutureProvider.autoDispose.family<List<PublicProfile>, String>(
  (ref, interestId) => ref.watch(apiProvider).discoverGroupMembers(interestId),
);

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
  'connect',
  'disconnect',
  'match',
  'superlike',
  'request:new',
  'request:updated',
  'message:new',
  'message:read',
  'message:viewed',
  'message:delivered',
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
// Erişim jetonu kısa ömürlü: bağlantı reddedilirse jeton yenilenip tekrar bağlanılır
final realtimeProvider = Provider<Realtime>((ref) {
  final auth = ref.watch(sessionProvider.select((s) => s.value?.auth));
  final controller = StreamController<RealtimeEvent>.broadcast();
  ref.onDispose(controller.close);
  if (auth == null) return Realtime._(null, controller);

  final socket = io.io(
    apiBaseUrl,
    io.OptionBuilder().setTransports(['websocket']).setAuth({'token': auth.access}).enableForceNew().build(),
  );
  var disposed = false;
  ref.onDispose(() => disposed = true);
  // Her yeniden bağlanma denemesinde güncel jeton
  socket.io.on('reconnect_attempt', (_) => socket.auth = {'token': auth.access});
  var retrying = false;
  socket.onConnectError((_) async {
    if (retrying || disposed) return;
    retrying = true;
    try {
      final token = await ref.read(apiProvider).freshAccessToken();
      await Future<void>.delayed(const Duration(seconds: 2));
      if (disposed || token == null || socket.connected) return;
      socket.auth = {'token': token};
      socket.connect();
    } catch (_) {
      // Oturum kapandıysa apiProvider çıkış yaptırır; ağ yoksa bir sonraki denemede tekrar
    } finally {
      retrying = false;
    }
  });
  for (final name in _events) {
    socket.on(name, (data) {
      if (!controller.isClosed) controller.add(RealtimeEvent(name, data));
    });
  }
  ref.onDispose(socket.dispose);
  return Realtime._(socket, controller);
});
