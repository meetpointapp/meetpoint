import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_card_swiper/flutter_card_swiper.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/catalog.dart';
import '../../core/location.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
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

  @override
  void initState() {
    super.initState();
    _load();
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
      final cards = await ref.read(apiProvider).discover();
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

  // Sağ: beğen · Sol: geç · Yukarı: süper beğeni (jetonla). Hata olursa kart geri döner.
  Future<bool> _onSwipe(int index, int? next, CardSwiperDirection direction) async {
    final l = AppLocalizations.of(context);
    final action = switch (direction) {
      CardSwiperDirection.right => 'like',
      CardSwiperDirection.top => 'superlike',
      _ => 'pass',
    };
    HapticFeedback.lightImpact();
    final profile = _cards![index];
    try {
      final r = await ref.read(apiProvider).swipe(profile.id, action);
      if (!mounted) return true;
      setState(() => _current = next ?? index);
      if (action == 'superlike') {
        ref.invalidate(walletProvider);
        showSnack(context, l.superLikeSent);
      }
      if (r.match) {
        ref.invalidate(conversationsProvider);
        ref.invalidate(likesProvider);
        HapticFeedback.mediumImpact();
        _showMatch(profile, r.conversationId!);
      }
      return true;
    } catch (e) {
      if (!mounted) return false;
      final low = e is ApiException && e.code == 'insufficient_balance';
      showSnack(context, errorText(l, e),
          action: low ? SnackBarAction(label: l.topUp, onPressed: () => context.go('/wallet')) : null);
      return false;
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
    final ok = await showModalBottomSheet<bool>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(shape: BoxShape.circle, gradient: Brand.gradient),
              child: const Icon(Icons.bolt_rounded, color: Colors.white, size: 36),
            ),
            const SizedBox(height: 14),
            Text(l.boostTitle, style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(l.boostBody(prices.boostMinutes), textAlign: TextAlign.center),
            const SizedBox(height: 20),
            GradientButton(
              label: '${l.boost} · ${l.coins(prices.boost)}',
              icon: Icons.bolt_rounded,
              onPressed: () => Navigator.pop(ctx, true),
            ),
          ]),
        ),
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(apiProvider).boost();
      ref.invalidate(meProvider);
      ref.invalidate(walletProvider);
    } catch (e) {
      if (!mounted) return;
      final low = e is ApiException && e.code == 'insufficient_balance';
      showSnack(context, errorText(l, e),
          action: low ? SnackBarAction(label: l.topUp, onPressed: () => context.go('/wallet')) : null);
    }
  }

  void _showMatch(PublicProfile other, String conversationId) {
    final me = ref.read(meProvider).value?.profile;
    showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'match',
      barrierColor: Colors.black87,
      transitionDuration: const Duration(milliseconds: 350),
      pageBuilder: (ctx, _, _) => _MatchOverlay(
        me: me,
        other: other,
        onChat: () {
          Navigator.pop(ctx);
          context.push('/chat/$conversationId');
        },
      ),
      transitionBuilder: (_, anim, _, child) => FadeTransition(
        opacity: anim,
        child: ScaleTransition(
          scale: Tween(begin: 0.85, end: 1.0).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutBack)),
          child: child,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
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
          child: CardSwiper(
            key: ValueKey(_deckVersion),
            controller: _controller,
            cardsCount: cards.length,
            numberOfCardsDisplayed: cards.length.clamp(1, 2),
            isLoop: false,
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
            backCardOffset: const Offset(0, 0),
            scale: 0.94,
            allowedSwipeDirection: const AllowedSwipeDirection.only(left: true, right: true, up: true),
            onSwipe: _onSwipe,
            onEnd: () => setState(() => _finished = true),
            cardBuilder: (context, index, dx, dy) =>
                _ProfileCard(profile: cards[index], dx: dx, dy: dy, myInterests: myInterests),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _RoundButton(
              icon: Icons.close_rounded,
              color: Brand.nope,
              tooltip: l.reject,
              onTap: () => _controller.swipe(CardSwiperDirection.left),
            ),
            const SizedBox(width: 14),
            _RoundButton(
              icon: Icons.star_rounded,
              color: _superBlue,
              size: 46,
              tooltip: l.superLike,
              onTap: () => _controller.swipe(CardSwiperDirection.top),
            ),
            const SizedBox(width: 14),
            _RoundButton(
              icon: Icons.mail_rounded,
              color: Brand.gold,
              size: 46,
              tooltip: l.messageRequest,
              onTap: () => sendContactRequest(context, ref, cards[_current.clamp(0, cards.length - 1)], RequestKind.message),
            ),
            const SizedBox(width: 14),
            _RoundButton(
              icon: Icons.favorite_rounded,
              gradient: true,
              size: 64,
              tooltip: l.accept,
              onTap: () => _controller.swipe(CardSwiperDirection.right),
            ),
          ]),
        ),
      ]);
    }

    return Scaffold(
      appBar: AppBar(
        title: const BrandLogo(size: 26),
        actions: [
          if (boostLeft > 0)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              // Kompakt sayaç: logo sığsın diye sadece kalan süre
              child: Tooltip(
                message: l.boostTitle,
                child: Chip(
                  avatar: const Icon(Icons.bolt_rounded, color: Brand.coral, size: 18),
                  label: Text(l.boostActive(boostLeft)),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            )
          else
            IconButton(onPressed: _openBoost, icon: const Icon(Icons.bolt_rounded), tooltip: l.boost),
          IconButton(onPressed: _openFilters, icon: const Icon(Icons.tune_rounded), tooltip: l.filters),
        ],
      ),
      body: SafeArea(top: false, child: body),
    );
  }
}

class _ProfileCard extends StatefulWidget {
  const _ProfileCard({required this.profile, required this.dx, required this.dy, required this.myInterests});
  final PublicProfile profile;
  final int dx; // kaydırma yönü/yüzdesi: +sağ (beğen), -sol (geç)
  final int dy; // -yukarı (süper beğeni)
  final Set<String> myInterests;

  @override
  State<_ProfileCard> createState() => _ProfileCardState();
}

class _ProfileCardState extends State<_ProfileCard> {
  int _photo = 0;

  // Kartın sol/sağ yarısına dokununca fotoğraflar arasında geç
  void _tap(TapUpDetails d, double width) {
    final count = widget.profile.photos.length;
    if (count < 2) return;
    setState(() {
      _photo = d.localPosition.dx < width / 2 ? (_photo - 1).clamp(0, count - 1) : (_photo + 1).clamp(0, count - 1);
    });
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
        onTapUp: (d) => _tap(d, box.maxWidth),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 16, offset: const Offset(0, 6))],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
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
              if (p.superLikedMe)
                Positioned(
                  top: 20,
                  left: 14,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: const ShapeDecoration(shape: StadiumBorder(), color: _superBlue),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.star_rounded, color: Colors.white, size: 16),
                      const SizedBox(width: 4),
                      Text(l.superLikedYou,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
                    ]),
                  ),
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
              Positioned(
                left: 18,
                right: 18,
                bottom: 18,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
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
                          TextSpan(text: '  ${p.age}', style: const TextStyle(fontWeight: FontWeight.w400)),
                        ]),
                        style: theme.textTheme.headlineMedium?.copyWith(color: Colors.white),
                      ),
                    ),
                    _InfoButton(onTap: () => context.push('/user/${p.id}')),
                  ]),
                  const SizedBox(height: 4),
                  Wrap(spacing: 12, runSpacing: 4, children: [
                    // Mesafe biliniyorsa onu, değilse şehri göster
                    if (p.distanceKm != null)
                      _Meta(icon: Icons.near_me_outlined, text: l.kmAway(p.distanceKm!))
                    else if (p.location.isNotEmpty)
                      _Meta(icon: Icons.place_outlined, text: p.location),
                    if (p.lookingFor.isNotEmpty)
                      _Meta(emoji: lookingForEmoji[p.lookingFor], text: l.lookingForLabel(p.lookingFor)),
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
  const _Meta({this.icon, this.emoji, required this.text});
  final IconData? icon;
  final String? emoji;
  final String text;

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
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
        child: Material(
          color: Colors.white.withValues(alpha: 0.2),
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: const Padding(
              padding: EdgeInsets.all(8),
              child: Icon(Icons.keyboard_arrow_up_rounded, color: Colors.white, size: 22),
            ),
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

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.icon,
    required this.onTap,
    required this.tooltip,
    this.color,
    this.gradient = false,
    this.size = 56,
  });
  final IconData icon;
  final Color? color;
  final bool gradient;
  final VoidCallback onTap;
  final double size;
  final String tooltip;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: tooltip,
        excludeSemantics: true,
        onTap: onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: gradient ? Brand.gradient : null,
            color: gradient ? null : Theme.of(context).cardTheme.color,
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 10, offset: const Offset(0, 3))],
          ),
          child: Material(
            type: MaterialType.transparency,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onTap,
              child: SizedBox.square(
                dimension: size,
                child: Icon(icon, color: gradient ? Colors.white : color, size: size * 0.46),
              ),
            ),
          ),
        ),
      );
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
        const Icon(Icons.near_me_rounded, color: Brand.coral, size: 20),
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

// Eşleşme ekranı: iki fotoğraf üst üste, ortada kalp
class _MatchOverlay extends StatelessWidget {
  const _MatchOverlay({required this.me, required this.other, required this.onChat});
  final PublicProfile? me;
  final PublicProfile other;
  final VoidCallback onChat;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);

    Widget photo(PublicProfile? p, double angle) => Transform.rotate(
          angle: angle,
          child: Container(
            width: 130,
            height: 170,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 16)],
            ),
            child: ClipRRect(borderRadius: BorderRadius.circular(15), child: NetPhoto(p?.coverUrl)),
          ),
        );

    return Material(
      type: MaterialType.transparency,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            ShaderMask(
              shaderCallback: (r) => Brand.gradient.createShader(r),
              blendMode: BlendMode.srcIn,
              child: Text(l.itsAMatch,
                  style: theme.textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w900, color: Colors.white)),
            ),
            const SizedBox(height: 28),
            SizedBox(
              height: 190,
              width: 280,
              child: Stack(alignment: Alignment.center, children: [
                Positioned(left: 0, top: 0, bottom: 0, child: Center(child: photo(me, -0.12))),
                Positioned(right: 0, top: 0, bottom: 0, child: Center(child: photo(other, 0.12))),
                Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(shape: BoxShape.circle, gradient: Brand.gradient),
                  child: const Icon(Icons.favorite_rounded, color: Colors.white, size: 28),
                ),
              ]),
            ),
            const SizedBox(height: 24),
            Text(l.matchBody(other.displayName),
                textAlign: TextAlign.center, style: theme.textTheme.bodyLarge?.copyWith(color: Colors.white70)),
            const SizedBox(height: 28),
            GradientButton(label: l.sendMessage, icon: Icons.chat_bubble_rounded, onPressed: onChat),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(l.keepSwiping, style: const TextStyle(color: Colors.white70)),
            ),
          ]),
        ),
      ),
    );
  }
}
