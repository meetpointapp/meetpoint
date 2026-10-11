import 'dart:async';

import 'package:flutter/foundation.dart';
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
import '../../core/tips.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../matches/matches_screen.dart';
import '../../l10n/app_localizations.dart';
import '../moderation/sanction_dialogs.dart';
import '../onboarding/intro_screen.dart';
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
  // Anlık bağlantı kopunca üstte ince bir çevrimdışı şeridi gösterilir (Faz 16: durum ekranları)
  bool _offline = false;

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
    // Yerel gelen arama ekranından (CallKit/Android tam ekran) kabul/ret (Faz 15).
    // Eklentinin web karşılığı yok; web'de dinlemeye çalışmak MissingPluginException fırlatır.
    if (!kIsWeb) _callKitSub = FlutterCallkitIncoming.onEvent.listen(_onCallKitEvent);
    // Mağaza hesabını kullanıcıya bağla (satın almalar bu kimlikle webhook'a düşer)
    final userId = ref.read(sessionProvider).value?.userId;
    if (userId != null) CoinStore.instance.login(userId);
    // Görülmemiş uyarı/kısıt varsa açılışta göster (itiraz seçeneğiyle); ardından, ilk kez
    // buradaysa (ve kısıt yoksa) kısa "nasıl çalışır" tanıtımı (Faz 16)
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _checkSanction();
      await _maybeShowIntro();
    });
  }

  Future<void> _maybeShowIntro() async {
    if (!mounted) return;
    final first = await TipsStore.consumeFirstTime('intro_v1');
    if (!first || !mounted) return;
    await showIntro(context);
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
      case 'disconnect':
        if (mounted) setState(() => _offline = true);
      case 'connect':
        if (mounted && _offline) setState(() => _offline = false);
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
    final newMatches = newMatchCount(ref.watch(conversationsProvider).value ?? const []);
    final unread = ref.watch(unreadCountProvider);
    // Günlük giriş ödülü alınmadıysa profil simgesinde kırmızı nokta
    final dailyDot = ref.watch(dailyClaimableProvider).value ?? false;

    return Scaffold(
      body: Column(children: [
        if (_offline)
          Material(
            color: Theme.of(context).colorScheme.errorContainer,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.wifi_off_rounded, size: 16, color: Theme.of(context).colorScheme.onErrorContainer),
                  const SizedBox(width: 8),
                  Text(l.offlineBanner,
                      style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer, fontSize: 13)),
                ]),
              ),
            ),
          ),
        Expanded(
          child: AppBackdrop(
            // Sekme sayfalarının Scaffold'ları saydam: zemin ışıkları görünsün
            child: Theme(
              data: Theme.of(context).copyWith(scaffoldBackgroundColor: Colors.transparent),
              child: widget.shell,
            ),
          ),
        ),
      ]),
      // Faz 20: Tinder tarzı yüzen hap alt menü — seçili sekme etiketiyle genişler, diğerleri sadece simge
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 10),
          child: Container(
            height: 64,
            padding: const EdgeInsets.symmetric(horizontal: 6),
            decoration: BoxDecoration(
              color: Theme.of(context).cardTheme.color,
              borderRadius: BorderRadius.circular(34),
              border: Border.all(color: Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.5)),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 22, offset: const Offset(0, 8))],
            ),
            child: Row(children: [
              for (final (i, d) in [
                (Icons.style_outlined, Icons.style_rounded, l.navDiscover, 0, false),
                (Icons.favorite_border_rounded, Icons.favorite_rounded, l.matchesTitle, newMatches, false),
                (Icons.chat_bubble_outline_rounded, Icons.chat_bubble_rounded, l.navChats, unread + pending, false),
                (Icons.account_balance_wallet_outlined, Icons.account_balance_wallet_rounded, l.navWallet, 0, false),
                (Icons.storefront_outlined, Icons.storefront_rounded, l.navStore, 0, false),
                (Icons.person_outline_rounded, Icons.person_rounded, l.navProfile, 0, dailyDot),
              ].indexed)
                Expanded(
                  flex: widget.shell.currentIndex == i ? 6 : 2,
                  child: _NavItem(
                    icon: d.$1,
                    selectedIcon: d.$2,
                    label: d.$3,
                    badge: d.$4,
                    dot: d.$5,
                    selected: widget.shell.currentIndex == i,
                    onTap: () => widget.shell.goBranch(i, initialLocation: i == widget.shell.currentIndex),
                  ),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.icon, required this.selectedIcon, required this.label, required this.badge, required this.dot, required this.selected, required this.onTap});
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final int badge;
  // Sayı yerine sadece kırmızı nokta (ör. günlük ödül hazır)
  final bool dot;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = selected ? Brand.coral : scheme.onSurfaceVariant;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Center(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            height: 46,
            padding: EdgeInsets.symmetric(horizontal: selected ? 14 : 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(26),
              color: selected ? Brand.coral.withValues(alpha: 0.14) : Colors.transparent,
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Badge(
                isLabelVisible: badge > 0 || dot,
                smallSize: badge > 0 ? null : 10,
                backgroundColor: const Color(0xFFE5383B),
                textColor: Colors.white,
                label: badge > 0 ? Text(badge > 99 ? '99+' : '$badge') : null,
                child: Icon(selected ? selectedIcon : icon, color: color, size: 24),
              ),
              if (selected) ...[
                const SizedBox(width: 6),
                Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12.5))),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}
