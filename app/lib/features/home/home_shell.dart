import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_callkit_incoming/entities/entities.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/location.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/push.dart';
import '../../core/session.dart';
import '../../core/store.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import '../moderation/sanction_dialogs.dart';
import '../../router.dart';

// Alt menülü ana iskelet. Anlık olaylara göre listeleri tazeler ve uygulama
// açıkken kısa bildirimler gösterir (push, uygulama kapalıyken devreye girer).
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  StreamSubscription<RealtimeEvent>? _sub;
  StreamSubscription<CallEvent?>? _callKitSub;

  @override
  void initState() {
    super.initState();
    _sub = ref.read(realtimeProvider).events.listen(_onEvent);
    final api = ref.read(apiProvider);
    // Konumu sessizce tazele (izin daha önce verildiyse) ve bildirim cihazını kaydet
    syncLocation(api);
    Push.instance.register(api, onOpen: (route) {
      if (mounted) context.push(route);
    });
    // Yerel gelen arama ekranından (CallKit/Android tam ekran) kabul/ret (Faz 15)
    _callKitSub = FlutterCallkitIncoming.onEvent.listen(_onCallKitEvent);
    // Mağaza hesabını kullanıcıya bağla (satın almalar bu kimlikle webhook'a düşer)
    final userId = ref.read(sessionProvider).value?.userId;
    if (userId != null) CoinStore.instance.login(userId);
    // Görülmemiş uyarı/kısıt varsa açılışta göster (itiraz seçeneğiyle)
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkSanction());
  }

  Future<void> _onCallKitEvent(CallEvent? event) async {
    switch (event) {
      case CallEventActionCallAccept(:final callKitParams):
        final id = callKitParams.id;
        try {
          await ref.read(apiProvider).acceptCall(id);
        } catch (_) {}
        if (mounted) context.push('/call/$id');
      case CallEventActionCallDecline(:final callKitParams):
        try {
          await ref.read(apiProvider).hangUp(callKitParams.id);
        } catch (_) {}
      default:
        break;
    }
  }

  Future<void> _checkSanction() async {
    Sanction? s;
    try {
      s = (await ref.read(meProvider.future)).pendingSanction;
    } catch (_) {
      return;
    }
    if (s == null || !mounted) return;
    await showSanctionDialog(context, ref, s);
    ref.invalidate(meProvider);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _callKitSub?.cancel();
    super.dispose();
  }

  String get _currentPath => ref.read(routerProvider).routerDelegate.currentConfiguration.uri.path;

  void _banner(String text, String route) {
    if (!mounted) return;
    final l = AppLocalizations.of(context);
    showSnack(context, text, action: SnackBarAction(label: l.view, onPressed: () => context.push(route)));
  }

  Future<void> _onEvent(RealtimeEvent event) async {
    final l = AppLocalizations.of(context);
    switch (event.name) {
      case 'request:new':
      case 'request:updated':
        ref.invalidate(requestsProvider(true));
        ref.invalidate(requestsProvider(false));
        ref.invalidate(walletProvider);
        ref.invalidate(meProvider);
        ref.invalidate(conversationsProvider);
        if (event.name == 'request:new') _banner(l.newRequestBanner, '/requests');
      case 'message:new':
        final msg = ChatMessage.fromJson(Map<String, dynamic>.from(event.data as Map));
        final convs = await ref.refresh(conversationsProvider.future).catchError((_) => <Conversation>[]);
        if (_currentPath == '/chat/${msg.conversationId}') return;
        final name = convs.where((c) => c.id == msg.conversationId).firstOrNull?.user?.displayName ?? '';
        _banner(l.newMessageFrom(name, msg.isPhoto ? '📷 ${l.photo}' : msg.body), '/chat/${msg.conversationId}');
      case 'match':
        final data = Map<String, dynamic>.from(event.data as Map);
        final convs = await ref.refresh(conversationsProvider.future).catchError((_) => <Conversation>[]);
        final name = convs.where((c) => c.id == data['conversationId']).firstOrNull?.user?.displayName ?? '';
        _banner(l.newMatchWith(name), '/chat/${data['conversationId']}');
      case 'sanction':
        ref.invalidate(meProvider);
        await _checkSanction();
      case 'superlike':
        ref.invalidate(likesProvider);
        final fromId = Map<String, dynamic>.from(event.data as Map)['fromId'];
        _banner('⭐ ${l.superLikedYou}', '/user/$fromId');
      case 'message:read':
      case 'message:viewed':
        ref.invalidate(conversationsProvider);
      case 'wallet:updated':
        ref.invalidate(walletProvider);
        ref.invalidate(meProvider);
        ref.invalidate(payoutsProvider);
      case 'call:charged':
      case 'call:gift':
        ref.invalidate(walletProvider);
      case 'call:ended':
        ref.invalidate(callHistoryProvider);
        ref.invalidate(walletProvider);
        final call = CallInfo.fromJson(Map<String, dynamic>.from(event.data as Map));
        // Arama ekranı açık değilken kaçırılan arama: kısa bildirim
        if (!call.outgoing && call.status == CallStatus.missed && !_currentPath.startsWith('/call/')) {
          _banner(l.missedCallFrom(call.user?.displayName ?? ''), '/calls');
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final pending = ref.watch(requestsProvider(true)).value?.where((r) => r.isPending).length ?? 0;
    final unread = ref.watch(unreadCountProvider);

    Widget badged(IconData icon, int count) =>
        Badge(isLabelVisible: count > 0, label: Text('$count'), child: Icon(icon));

    return Scaffold(
      body: widget.shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: widget.shell.currentIndex,
        onDestinationSelected: (i) => widget.shell.goBranch(i, initialLocation: i == widget.shell.currentIndex),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.style_outlined),
            selectedIcon: const Icon(Icons.style_rounded),
            label: l.navDiscover,
          ),
          NavigationDestination(
            icon: badged(Icons.mail_outline_rounded, pending),
            selectedIcon: badged(Icons.mail_rounded, pending),
            label: l.navRequests,
          ),
          NavigationDestination(
            icon: badged(Icons.chat_bubble_outline_rounded, unread),
            selectedIcon: badged(Icons.chat_bubble_rounded, unread),
            label: l.navChats,
          ),
          NavigationDestination(
            icon: const Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: const Icon(Icons.account_balance_wallet_rounded),
            label: l.navWallet,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline_rounded),
            selectedIcon: const Icon(Icons.person_rounded),
            label: l.navProfile,
          ),
        ],
      ),
    );
  }
}
