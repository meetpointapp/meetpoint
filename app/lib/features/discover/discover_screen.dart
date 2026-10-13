import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_card_swiper/flutter_card_swiper.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/catalog.dart';
import '../../core/celebration.dart';
import '../../core/fx.dart';
import '../../core/location.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import '../profile/mood_widgets.dart';
import '../store/superlike_packs.dart';
import 'match_modes.dart';
import '../profile/profile_widgets.dart';
import '../profile/request_actions.dart';

class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  final _controller = CardSwiperController();
  List<PublicProfile>? _cards;
  Object? _error;
  bool _finished = false;
  int _current = 0;
  // Yeni deste yüklendiğinde CardSwiper'ı sıfırlamak için
  int _deckVersion = 0;
  // Faz 20: eşleştirme modu (all | astro | music | interests | vibe)
  String _mode = 'all';
  // Faz 20: günlük beğeni hakkı (sayaç). null = henüz yüklenmedi (kısıt uygulanmaz, sunucu zaten korur)
  LikeStatus? _likes;
  // Faz 20: süper beğeni hakları (günlük ücretsiz + satın alınmış)
  SuperLikeStatus? _superLikes;
  String? _buyingPack;

  @override
  void initState() {
    super.initState();
    _load();
    _loadLikes();
    _loadSuperLikes();
  }

  Future<void> _loadLikes() async {
    try {
      final s = await ref.read(apiProvider).likeStatus();
      if (mounted) setState(() => _likes = s);
    } catch (_) {}
  }

  // Durum keşfet ve mağaza arasında paylaşılır (superLikeStatusProvider): mağazadan alınan hak anında burada görünür
  Future<SuperLikeStatus?> _loadSuperLikes({bool fresh = false}) async {
    try {
      if (fresh) ref.invalidate(superLikeStatusProvider);
      final s = await ref.read(superLikeStatusProvider.future);
      if (mounted) setState(() => _superLikes = s);
      return s;
    } catch (_) {
      return null;
    }
  }

  // Süper beğeni hakkı bitince: paketleri göster (toplu alım daha ucuz), satın alınca hakkı ekle
  Future<void> _showSuperLikeSheet() async {
    final l = AppLocalizations.of(context);
    final SuperLikeStatus status = _superLikes ?? await ref.read(superLikeStatusProvider.future);
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final cur = _superLikes ?? status;
          final left = cur.nextFreeAt?.difference(DateTime.now());
          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: const BoxDecoration(shape: BoxShape.circle, color: _superBlue),
                  child: const Icon(Icons.star_rounded, color: Colors.white, size: 34),
                ),
                const SizedBox(height: 12),
                Text(l.superLikeLimitTitle, style: Theme.of(ctx).textTheme.titleLarge),
                const SizedBox(height: 6),
                Text(l.superLikeLimitBody(cur.daily), textAlign: TextAlign.center, style: Theme.of(ctx).textTheme.bodyMedium),
                if (left != null && !left.isNegative && cur.freeRemaining == 0) ...[
                  const SizedBox(height: 4),
                  Text(l.superLikeFreeIn(left.inHours, left.inMinutes % 60),
                      textAlign: TextAlign.center, style: Theme.of(ctx).textTheme.bodySmall),
                ],
                const SizedBox(height: 14),
                SuperLikePackTiles(
                  status: cur,
                  busyId: _buyingPack,
                  onBuy: (p) async {
                    setSheet(() => _buyingPack = p.id);
                    try {
                      final fresh = await ref.read(apiProvider).buySuperLikePack(p.id);
                      ref.invalidate(walletProvider);
                      ref.invalidate(superLikeStatusProvider);
                      Fx.success();
                      if (mounted) setState(() => _superLikes = fresh);
                      if (ctx.mounted) Navigator.pop(ctx);
                      if (mounted) showSnack(context, l.superLikeBought(p.count));
                    } catch (e) {
                      if (mounted) {
                        final low = e is ApiException && e.code == 'insufficient_balance';
                        // ignore: use_build_context_synchronously
                        showSnack(context, errorText(l, e),
                            // ignore: use_build_context_synchronously
                            action: low ? SnackBarAction(label: l.topUp, onPressed: () => context.go('/wallet')) : null);
                      }
                    } finally {
                      if (mounted) setSheet(() => _buyingPack = null);
                    }
                  },
                ),
              ]),
            ),
          );
        },
      ),
    );
  }

  // Hak bitince: kalan süreyi ve jetonla sıfırlama seçeneğini göster
  Future<void> _showLikeLimitSheet({bool info = false}) async {
    final l = AppLocalizations.of(context);
    final status = _likes ?? await ref.read(apiProvider).likeStatus().catchError((_) => const LikeStatus(limit: 25, used: 25, remaining: 0, resetPrice: 50));
    if (!mounted) return;
    final left = status.nextFreeAt?.difference(DateTime.now());
    final reset = await showModalBottomSheet<bool>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(shape: BoxShape.circle, gradient: Brand.gradient),
              child: const Icon(Icons.favorite_rounded, color: Colors.white, size: 34),
            ),
            const SizedBox(height: 14),
            // Sayaca dokununca (hak bitmediyse) bilgi, hak bittiğinde "bitti" başlığı
            Text(info && status.remaining > 0 ? l.likeInfoTitle(status.remaining, status.limit) : l.likeLimitTitle,
                style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(l.likeLimitBody(status.limit), textAlign: TextAlign.center),
            if (left != null && !left.isNegative) ...[
              const SizedBox(height: 6),
              Text(l.likeFreeIn(left.inHours, left.inMinutes % 60),
                  textAlign: TextAlign.center, style: Theme.of(ctx).textTheme.bodySmall),
            ],
            const SizedBox(height: 20),
            // Hiç hak kullanılmadıysa yenilenecek bir şey yok: düğme gösterilmez
            if (status.used > 0)
              GradientButton(
                label: l.likeLimitReset(status.resetPrice),
                icon: Icons.refresh_rounded,
                onPressed: () => Navigator.pop(ctx, true),
              ),
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(info ? l.closeAction : l.likeLimitWait)),
          ]),
        ),
      ),
    );
    if (reset != true || !mounted) return;
    try {
      final fresh = await ref.read(apiProvider).resetLikes();
      ref.invalidate(walletProvider);
      Fx.success();
      if (!mounted) return;
      setState(() => _likes = fresh);
      showSnack(context, l.likeResetDone(fresh.limit));
    } catch (e) {
      if (!mounted) return;
      final low = e is ApiException && e.code == 'insufficient_balance';
      showSnack(context, errorText(l, e),
          action: low ? SnackBarAction(label: l.topUp, onPressed: () => context.go('/wallet')) : null);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _cards = null;
      _error = null;
    });
    try {
      final cards = await ref.read(apiProvider).discover(mode: _mode);
      if (mounted) {
        setState(() {
          _cards = cards;
          _finished = cards.isEmpty;
          _current = 0;
          _deckVersion++;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  void _setMode(String mode) {
    if (mode == _mode) return;
    Fx.tap();
    setState(() {
      _mode = mode;
      _finished = false;
    });
    _load();
  }

  // Sağ: beğen · Sol: geç · Yukarı: süper beğeni (jetonla). Hata olursa kart geri döner.
  Future<bool> _onSwipe(int index, int? next, CardSwiperDirection direction) async {
    final l = AppLocalizations.of(context);
    final action = switch (direction) {
      CardSwiperDirection.right => 'like',
      CardSwiperDirection.top => 'superlike',
      _ => 'pass',
    };
    // Beğeni hakkı bittiyse kart geri döner ve sıfırlama seçeneği sunulur
    if (action == 'like' && (_likes?.remaining ?? 1) <= 0) {
      unawaited(_showLikeLimitSheet());
      return false;
    }
    // Süper beğeni hakkı (günlük ücretsiz + satın alınmış) bittiyse paket sayfası açılır.
    // Yerel bilgi eski olabilir (ör. mağazadan yeni alındı): önce sunucudan teyit edilir.
    if (action == 'superlike' && _superLikes != null && _superLikes!.total <= 0) {
      final fresh = await _loadSuperLikes(fresh: true);
      if (!mounted) return false;
      if (fresh == null || fresh.total <= 0) {
        unawaited(_showSuperLikeSheet());
        return false;
      }
    }
    Fx.tap();
    final profile = _cards![index];
    // Sıradaki kartın bilgileri hemen görünsün; istek başarısız olursa geri alınır
    final before = _current;
    setState(() => _current = next ?? index);
    try {
      final r = await ref.read(apiProvider).swipe(profile.id, action);
      if (!mounted) return true;
      setState(() {
        if (r.likes != null) _likes = r.likes;
        if (r.superLikes != null) _superLikes = r.superLikes;
      });
      if (action == 'superlike') {
        ref.invalidate(walletProvider);
        ref.invalidate(superLikeStatusProvider);
        showSnack(context, l.superLikeSent);
      }
      if (r.match) {
        ref.invalidate(conversationsProvider);
        ref.invalidate(likesProvider);
        showMatchCelebration(context, ref, other: profile, conversationId: r.conversationId!);
      }
      return true;
    } catch (e) {
      if (!mounted) return false;
      setState(() => _current = before);
      if (e is ApiException && e.code == 'superlike_limit_reached') {
        _loadSuperLikes(fresh: true);
        unawaited(_showSuperLikeSheet());
        return false;
      }
      if (e is ApiException && e.code == 'like_limit_reached') {
        _loadLikes();
        unawaited(_showLikeLimitSheet());
        return false;
      }
      final low = e is ApiException && e.code == 'insufficient_balance';
      showSnack(context, errorText(l, e),
          action: low ? SnackBarAction(label: l.topUp, onPressed: () => context.go('/wallet')) : null);
      return false;
    }
  }

  // Faz 23: karttaki kişiyle Doğruluk mu Cesaret mi oyunu başlat (açık oyun varsa ona gider)
  Future<void> _startTruthDare(PublicProfile profile) async {
    final l = AppLocalizations.of(context);
    try {
      final game = await ref.read(apiProvider).startTruthDare(profile.id);
      ref.invalidate(truthDareGamesProvider);
      if (mounted) context.push('/game/${game.id}');
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  Future<void> _askLocation() async {
    if (await syncLocation(ref.read(apiProvider), ask: true)) {
      ref.invalidate(meProvider);
      _load();
    }
  }

  Future<void> _openFilters() async {
    final me = await ref.read(meProvider.future);
    if (!mounted) return;
    final result = await showModalBottomSheet<DiscoverFilters>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _FiltersSheet(initial: me.filters),
    );
    if (result == null) return;
    await ref.read(apiProvider).saveFilters(result);
    ref.invalidate(meProvider);
    _load();
  }

  Future<void> _openBoost() async {
    final l = AppLocalizations.of(context);
    final prices = (await ref.read(walletProvider.future)).featurePrices;
    if (!mounted) return;
    // Süren öne çıkarma: kalan süre gösterilir, istenirse süre uzatılır (kalana eklenir)
    final until = ref.read(meProvider).value?.boostedUntil;
    final leftMin = until == null ? 0 : (until.difference(DateTime.now()).inSeconds / 60).ceil();
    final active = leftMin > 0;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(shape: BoxShape.circle, gradient: Brand.gradient),
              child: const Icon(Icons.bolt_rounded, color: Colors.white, size: 36),
            ),
            const SizedBox(height: 14),
            Text(active ? l.boostRunningTitle : l.boostTitle, style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 6),
            if (active) ...[
              Text(l.boostRemaining(leftMin),
                  style: Theme.of(ctx).textTheme.headlineSmall?.copyWith(color: Brand.coral, fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              Text(l.boostExtendBody(prices.boostMinutes), textAlign: TextAlign.center),
            ] else
              Text(l.boostBody(prices.boostMinutes), textAlign: TextAlign.center),
            const SizedBox(height: 20),
            GradientButton(
              label: active ? l.boostExtend(prices.boostMinutes) : l.boost,
              coin: prices.boost,
              icon: active ? Icons.add_rounded : Icons.bolt_rounded,
              onPressed: () => Navigator.pop(ctx, true),
            ),
            if (active) TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.closeAction)),
          ]),
        ),
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(apiProvider).boost();
      ref.invalidate(meProvider);
      ref.invalidate(walletProvider);
      Fx.success();
    } catch (e) {
      if (!mounted) return;
      final low = e is ApiException && e.code == 'insufficient_balance';
      showSnack(context, errorText(l, e),
          action: low ? SnackBarAction(label: l.topUp, onPressed: () => context.go('/wallet')) : null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    ref.listen<AsyncValue<SuperLikeStatus>>(superLikeStatusProvider, (_, next) {
      final v = next.value;
      if (v != null && mounted) setState(() => _superLikes = v);
    });
    final cards = _cards;
    final me = ref.watch(meProvider).value;
    final myInterests = me?.profile?.interests.toSet() ?? const <String>{};
    final boostedUntil = me?.boostedUntil;
    final boostLeft = boostedUntil == null ? 0 : boostedUntil.difference(DateTime.now()).inMinutes + 1;

    Widget body;
    if (_error != null) {
      body = ErrorRetry(error: _error!, onRetry: _load);
    } else if (cards == null) {
      body = const _DeckSkeleton();
    } else if (_finished && _mode != 'all') {
      body = ModeEmpty(mode: _mode, onBack: () => _setMode('all'));
    } else if (_finished) {
      body = CenteredMessage(
        icon: Icons.travel_explore_rounded,
        text: l.noMoreProfiles,
        action: FilledButton.tonal(onPressed: _load, child: Text(l.refresh)),
      );
    } else {
      body = Column(children: [
        if (me != null && !me.hasLocation) _LocationBar(onEnable: _askLocation),
        Expanded(
          child: Stack(children: [
            CardSwiper(
              key: ValueKey(_deckVersion),
              controller: _controller,
              cardsCount: cards.length,
              numberOfCardsDisplayed: cards.length.clamp(1, 2),
              isLoop: false,
              padding: const EdgeInsets.fromLTRB(6, 0, 6, 6),
              backCardOffset: const Offset(0, 0),
              scale: 0.95,
              allowedSwipeDirection: const AllowedSwipeDirection.only(left: true, right: true, up: true),
              onSwipe: _onSwipe,
              onEnd: () => setState(() => _finished = true),
              cardBuilder: (context, index, dx, dy) =>
                  _ProfileCard(profile: cards[index], dx: dx, dy: dy, myInterests: myInterests, showInfo: index <= _current),
            ),
            // Kartın üstünde cam rozetler: kalan beğeni hakkı (solda), seri ve ruh hali (sağda)
            Positioned(
              top: 22,
              left: 20,
              right: 20,
              child: Row(children: [
                if (_likes != null) _LikeCounter(status: _likes!, onTap: () => _showLikeLimitSheet(info: true)),
                const Spacer(),
                _GlassChip(
                  onTap: () => showMoodSheet(context, ref),
                  child: Text(
                    (me?.profile?.moodId ?? '').isEmpty ? '💭' : (moodEmoji[me!.profile!.moodId] ?? '💭'),
                    style: const TextStyle(fontSize: 15),
                  ),
                ),
              ]),
            ),
            // Tinder tarzı: kartın içinde, cam bir çubukta eylem düğmeleri
            Positioned(
              left: 18,
              right: 18,
              bottom: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.36),
                  borderRadius: BorderRadius.circular(44),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
                ),
                child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  _GlassButton(icon: Icons.close_rounded, size: 60, iconColor: Colors.white, tooltip: l.reject,
                      onTap: () => _controller.swipe(CardSwiperDirection.left)),
                  _GlassButton(icon: Icons.star_rounded, size: 46, iconColor: const Color(0xFF7FB2FF), tooltip: l.superLike,
                      badge: _superLikes == null ? null : '${_superLikes!.total}', badgeLow: (_superLikes?.total ?? 1) <= 0,
                      onTap: () => _controller.swipe(CardSwiperDirection.top)),
                  _GlassButton(icon: Icons.favorite_rounded, size: 66, iconColor: Brand.coral, ring: true, tooltip: l.accept,
                      onTap: () => _controller.swipe(CardSwiperDirection.right)),
                  _GlassButton(icon: Icons.casino_rounded, size: 46, iconColor: const Color(0xFFB9A4FF), tooltip: l.truthDareTitle,
                      onTap: () => _startTruthDare(cards[_current.clamp(0, cards.length - 1)])),
                  _GlassButton(icon: Icons.send_rounded, size: 46, iconColor: Colors.white, tooltip: l.messageRequest,
                      onTap: () => sendContactRequest(context, ref, cards[_current.clamp(0, cards.length - 1)], RequestKind.message)),
                ]),
              ),
            ),
          ]),
        ),
      ]);
    }

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          // Tinder tarzı sade başlık: logo, metin sekmeleri (modlar), şimşek (öne çıkar), filtre
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 6, 4),
            child: Row(children: [
              IconButton(onPressed: _openFilters, icon: const Icon(Icons.tune_rounded), tooltip: l.filters),
              Expanded(child: ModeBar(mode: _mode, onSelected: _setMode)),
              if (boostLeft > 0)
                Tooltip(
                  message: l.boostRunningTitle,
                  child: GestureDetector(
                    onTap: _openBoost,
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                      decoration: ShapeDecoration(shape: const StadiumBorder(), color: Brand.coral.withValues(alpha: 0.14)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.bolt_rounded, color: Brand.coral, size: 16),
                        const SizedBox(width: 2),
                        Text(l.boostActive(boostLeft), style: TextStyle(color: Brand.coral, fontWeight: FontWeight.w800, fontSize: 12)),
                        const SizedBox(width: 2),
                        Icon(Icons.add_rounded, color: Brand.coral, size: 14),
                      ]),
                    ),
                  ),
                )
              else
                IconButton(onPressed: _openBoost, icon: Icon(Icons.bolt_rounded, color: Brand.coral), tooltip: l.boost),
            ]),
          ),
          if (_mode == 'interests') const _GroupsStrip(),
          Expanded(child: body),
        ]),
      ),
    );
  }
}

// Faz 16: "İlgi alanı bazlı keşif" — salt kaydırma yerine ortak ilgiye göre vitrinler; kaydırma
// destesinin üstünde yatay bir şerit olarak göze çarpar, dokununca ızgara halinde grup açılır.
class _GroupsStrip extends ConsumerWidget {
  const _GroupsStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groups = ref.watch(interestGroupsProvider);
    final list = groups.value;
    if (list == null || list.isEmpty) return const SizedBox.shrink();
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
        child: Text(l.interestGroupsTitle, style: theme.textTheme.titleSmall),
      ),
      SizedBox(
        height: 92,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: list.length,
          separatorBuilder: (_, _) => const SizedBox(width: 10),
          itemBuilder: (_, i) {
            final g = list[i];
            return GestureDetector(
              onTap: () => context.push('/discover/groups/${g.interestId}'),
              child: Container(
                width: 132,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(Brand.radius),
                  color: Brand.coral.withValues(alpha: 0.08),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(interestEmoji[g.interestId] ?? '', style: const TextStyle(fontSize: 22)),
                  const SizedBox(height: 6),
                  Text(l.interestGroupName(g.interestId),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.labelLarge),
                  Text(l.interestGroupMemberCount(g.count),
                      style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                ]),
              ),
            );
          },
        ),
      ),
    ]);
  }
}

class _ProfileCard extends StatefulWidget {
  const _ProfileCard({required this.profile, required this.dx, required this.dy, required this.myInterests, this.showInfo = true});
  final PublicProfile profile;
  final int dx; // kaydırma yönü/yüzdesi: +sağ (beğen), -sol (geç)
  final int dy; // -yukarı (süper beğeni)
  final Set<String> myInterests;
  // Arkadaki (sıradaki) kartta bilgiler gizlenir: sürüklerken iki kartın yazısı üst üste binmesin
  final bool showInfo;

  @override
  State<_ProfileCard> createState() => _ProfileCardState();
}

class _ProfileCardState extends State<_ProfileCard> {
  int _photo = 0;

  // Karta her dokunuşta bir sonraki fotoğraf; sonuncudan sonra ilk fotoğrafa dönülür
  void _tap() {
    final count = widget.profile.photos.length;
    if (count < 2) return;
    setState(() => _photo = (_photo + 1) % count);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l = AppLocalizations.of(context);
    final p = widget.profile;
    final photos = p.photos;
    // Ortak ilgi alanları öne gelsin
    final interests = [...p.interests]..sort((a, b) =>
        (widget.myInterests.contains(b) ? 1 : 0) - (widget.myInterests.contains(a) ? 1 : 0));

    return LayoutBuilder(
      builder: (context, box) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _tap,
        child: DecoratedBox(
          // Faz 16: kişisel profil vitrini — özel bir renk seçilmişse kartın çerçevesinde görünür
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            // VibeUpMe+ aboneleri altın çerçeve ve sıcak bir parıltı alır (tema rengi çerçevesinin önüne geçer)
            border: p.premium
                ? Border.all(color: const Color(0xFFE9B949), width: 3)
                : (p.themeId.isEmpty ? null : Border.all(color: themeColorOf(p.themeId), width: 3)),
            boxShadow: [
              BoxShadow(
                color: p.premium ? const Color(0xFFE9B949).withValues(alpha: 0.38) : Colors.black.withValues(alpha: 0.12),
                blurRadius: p.premium ? 22 : 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(28),
            child: Stack(fit: StackFit.expand, children: [
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 150),
                // Varsayılan düzen çocuğu ortalar; fotoğraf kartı tamamen doldurmalı
                layoutBuilder: (current, previous) =>
                    Stack(fit: StackFit.expand, children: [...previous, ?current]),
                child: NetPhoto(photos.isEmpty ? null : photos[_photo].fullUrl, key: ValueKey(_photo)),
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment(0, 0.1),
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black87],
                  ),
                ),
              ),
              if (photos.length > 1)
                Positioned(
                  top: 8,
                  left: 10,
                  right: 10,
                  child: Row(children: [
                    for (var i = 0; i < photos.length; i++)
                      Expanded(
                        child: Container(
                          height: 3.5,
                          margin: const EdgeInsets.symmetric(horizontal: 2),
                          decoration: BoxDecoration(
                            color: i == _photo ? Colors.white : Colors.white38,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                  ]),
                ),
              // Kaydırma etiketi: yukarı = süper beğeni, sağ = beğen, sol = geç
              if (widget.dy < -10 && widget.dy.abs() > widget.dx.abs())
                Positioned(
                  top: 28,
                  left: 0,
                  right: 0,
                  child: Center(child: _Stamp(kind: _StampKind.superLike, opacity: (widget.dy.abs() / 100).clamp(0.0, 1.0))),
                )
              else if (widget.dx.abs() > 10)
                Positioned(
                  top: 28,
                  left: widget.dx > 0 ? 20 : null,
                  right: widget.dx < 0 ? 20 : null,
                  child: _Stamp(
                    kind: widget.dx > 0 ? _StampKind.like : _StampKind.nope,
                    opacity: (widget.dx.abs() / 100).clamp(0.0, 1.0),
                  ),
                ),
              if (widget.showInfo)
                Positioned(
                left: 22,
                right: 22,
                bottom: 104,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (p.match != null) MatchBubble(match: p.match!),
                  if (p.superLikedMe)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: const ShapeDecoration(shape: StadiumBorder(), color: _superBlue),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.star_rounded, color: Colors.white, size: 15),
                        const SizedBox(width: 4),
                        Text(l.superLikedYou, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
                      ]),
                    ),
                  Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Expanded(
                      child: Text.rich(
                        TextSpan(children: [
                          TextSpan(text: p.displayName, style: const TextStyle(fontWeight: FontWeight.w800)),
                          if (p.verified)
                            const WidgetSpan(
                              alignment: PlaceholderAlignment.middle,
                              child: Padding(padding: EdgeInsets.only(left: 8), child: VerifiedBadge(size: 24, onPhoto: true)),
                            ),
                          if (p.premium)
                            const WidgetSpan(
                              alignment: PlaceholderAlignment.middle,
                              child: Padding(padding: EdgeInsets.only(left: 8), child: PremiumBadge(size: 24)),
                            ),
                          TextSpan(text: '  ${p.age}', style: const TextStyle(fontWeight: FontWeight.w400)),
                        ]),
                        style: theme.textTheme.headlineMedium?.copyWith(color: Colors.white),
                      ),
                    ),
                    _InfoButton(onTap: () => context.push('/user/${p.id}')),
                  ]),
                  const SizedBox(height: 4),
                  Wrap(spacing: 14, runSpacing: 5, children: [
                    if (p.online) _Meta(dot: true, text: l.activeNow),
                    // Mesafe biliniyorsa onu, değilse şehri göster
                    if (p.distanceKm != null)
                      _Meta(icon: Icons.near_me_outlined, text: l.kmAway(p.distanceKm!))
                    else if (p.location.isNotEmpty)
                      _Meta(icon: Icons.place_outlined, text: p.location),
                    if (p.heightCm != null) _Meta(icon: Icons.straighten_rounded, text: l.heightCm(p.heightCm!)),
                    if (p.lookingFor.isNotEmpty)
                      _Meta(emoji: lookingForEmoji[p.lookingFor], text: l.lookingForLabel(p.lookingFor)),
                    if (p.job.isNotEmpty) _Meta(icon: Icons.work_outline_rounded, text: p.job),
                    if (p.milestoneCount > 0) MilestoneBadge(p.milestoneCount, onPhoto: true),
                  ]),
                  if (interests.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(spacing: 6, runSpacing: 6, children: [
                      for (final id in interests.take(3))
                        InterestChip(id, onPhoto: true, highlighted: widget.myInterests.contains(id)),
                    ]),
                  ],
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({this.icon, this.emoji, this.dot = false, required this.text});
  final IconData? icon;
  final String? emoji;
  final bool dot; // yeşil "aktif" noktası
  final String text;

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        if (dot) Container(width: 8, height: 8, margin: const EdgeInsets.only(right: 2), decoration: const BoxDecoration(shape: BoxShape.circle, color: Brand.like)),
        if (icon != null) Icon(icon, size: 16, color: Colors.white70),
        if (emoji != null) Text(emoji!, style: const TextStyle(fontSize: 13)),
        const SizedBox(width: 4),
        Text(text, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.9))),
      ]);
}

class _InfoButton extends StatelessWidget {
  const _InfoButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: AppLocalizations.of(context).viewProfile,
        excludeSemantics: true,
        onTap: onTap,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.black.withValues(alpha: 0.3),
              border: Border.all(color: Colors.white.withValues(alpha: 0.7), width: 1.4),
            ),
            child: const Icon(Icons.info_outline_rounded, color: Colors.white, size: 22),
          ),
        ),
      );
}

const _superBlue = Color(0xFF2F80ED);

enum _StampKind { like, nope, superLike }

// Kart kaydırılırken beliren küçük etiket: beğen / geç / süper beğeni
class _Stamp extends StatelessWidget {
  const _Stamp({required this.kind, required this.opacity});
  final _StampKind kind;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    final (color, icon) = switch (kind) {
      _StampKind.like => (Brand.like, Icons.favorite_rounded),
      _StampKind.nope => (Brand.nope, Icons.close_rounded),
      _StampKind.superLike => (_superBlue, Icons.star_rounded),
    };
    return Opacity(
      opacity: opacity,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.black26,
          border: Border.all(color: color, width: 2.5),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: color, size: 28),
      ),
    );
  }
}

// Konum izni yoksa destenin üstünde ince bir çubuk
class _LocationBar extends StatelessWidget {
  const _LocationBar({required this.onEnable});
  final VoidCallback onEnable;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 6),
      padding: const EdgeInsets.fromLTRB(14, 8, 6, 8),
      decoration: BoxDecoration(
        color: Brand.coral.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(Brand.radius),
      ),
      child: Row(children: [
        Icon(Icons.near_me_rounded, color: Brand.coral, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Text(l.locationRationale, maxLines: 2, overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall),
        ),
        TextButton(onPressed: onEnable, child: Text(l.enableLocation)),
      ]),
    );
  }
}

// Filtreler: yaş aralığı ve en fazla uzaklık
class _FiltersSheet extends StatefulWidget {
  const _FiltersSheet({required this.initial});
  final DiscoverFilters initial;

  @override
  State<_FiltersSheet> createState() => _FiltersSheetState();
}

class _FiltersSheetState extends State<_FiltersSheet> {
  static const _anyKm = 205.0; // kaydırıcının sonu = mesafe sınırı yok
  late RangeValues _age = RangeValues(widget.initial.minAge.toDouble(), widget.initial.maxAge.toDouble().clamp(18, 80));
  late double _km = widget.initial.maxKm == 0 ? _anyKm : widget.initial.maxKm.toDouble().clamp(5, 200);

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final anyKm = _km >= _anyKm;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(l.filters, style: theme.textTheme.titleLarge),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: Text(l.ageRange, style: theme.textTheme.titleSmall)),
            Text('${_age.start.round()} – ${_age.end.round()}', style: theme.textTheme.titleSmall),
          ]),
          RangeSlider(
            values: _age,
            min: 18,
            max: 80,
            divisions: 62,
            onChanged: (v) => setState(() => _age = v),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: Text(l.maxDistance, style: theme.textTheme.titleSmall)),
            Text(anyKm ? l.anyDistance : '${_km.round()} km', style: theme.textTheme.titleSmall),
          ]),
          Slider(
            value: _km,
            min: 5,
            max: _anyKm,
            divisions: 40,
            onChanged: (v) => setState(() => _km = v),
          ),
          const SizedBox(height: 12),
          GradientButton(
            label: l.apply,
            onPressed: () => Navigator.pop(
              context,
              DiscoverFilters(minAge: _age.start.round(), maxAge: _age.end.round(), maxKm: anyKm ? 0 : _km.round()),
            ),
          ),
        ]),
      ),
    );
  }
}

class _DeckSkeleton extends StatelessWidget {
  const _DeckSkeleton();

  @override
  Widget build(BuildContext context) => const Skeleton(
        child: Padding(
          padding: EdgeInsets.fromLTRB(12, 4, 12, 90),
          child: SkeletonBox(height: double.infinity, radius: 24),
        ),
      );
}

// Kartın üstündeki yarı saydam (cam) küçük rozet
class _GlassChip extends StatelessWidget {
  const _GlassChip({required this.child, this.onTap});
  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.42),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
          child: child,
        ),
      );
}

// Faz 20: kalan beğeni hakkı. Azaldıkça renk değişir; dokununca bilgi/yenileme sayfası açılır.
class _LikeCounter extends StatelessWidget {
  const _LikeCounter({required this.status, required this.onTap});
  final LikeStatus status;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final out = status.remaining <= 0;
    final low = !out && status.remaining <= 5;
    final color = out ? Brand.nope : (low ? Brand.gold : Colors.white);
    return Semantics(
      button: true,
      label: l.likeCounterTooltip(status.remaining, status.limit),
      excludeSemantics: true,
      onTap: onTap,
      child: _GlassChip(
        onTap: onTap,
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.favorite_rounded, size: 14, color: color),
          const SizedBox(width: 5),
          Text('${status.remaining}/${status.limit}', style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 13)),
        ]),
      ),
    );
  }
}

// Cam çubuktaki yuvarlak eylem düğmesi (Tinder tarzı: ince çerçeveli, yarı saydam)
class _GlassButton extends StatelessWidget {
  const _GlassButton({required this.icon, required this.onTap, required this.tooltip, required this.size, required this.iconColor, this.ring = false, this.badge, this.badgeLow = false});
  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;
  final double size;
  final Color iconColor;
  final bool ring; // vurgulu çerçeve (beğen)
  final String? badge; // sağ üstte küçük sayı (kalan süper beğeni)
  final bool badgeLow; // 0 kaldıysa vurgulu

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: tooltip,
        excludeSemantics: true,
        onTap: onTap,
        child: GestureDetector(
          onTap: onTap,
          child: Stack(clipBehavior: Clip.none, children: [
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.black.withValues(alpha: ring ? 0.25 : 0.18),
                border: Border.all(color: ring ? iconColor.withValues(alpha: 0.9) : Colors.white.withValues(alpha: 0.28), width: ring ? 2 : 1),
              ),
              child: Icon(icon, color: iconColor, size: size * 0.5),
            ),
            if (badge != null)
              Positioned(
                top: -3,
                right: -3,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 20),
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                  decoration: BoxDecoration(
                    shape: BoxShape.rectangle,
                    borderRadius: BorderRadius.circular(10),
                    color: badgeLow ? Brand.nope : _superBlue,
                  ),
                  child: Text(badge!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11)),
                ),
              ),
          ]),
        ),
      );
}
