import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/formatters.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import 'call_media.dart';
import 'start_call.dart';

// Tam ekran arama: çalıyor (giden/gelen) → görüşme → bitti (özet + puan)
class CallScreen extends ConsumerStatefulWidget {
  const CallScreen({super.key, required this.callId, this.initial});
  final String callId;
  final CallInfo? initial;

  @override
  ConsumerState<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends ConsumerState<CallScreen> {
  CallInfo? _call;
  CallMediaEngine? _media;
  StreamSubscription<RealtimeEvent>? _sub;
  Timer? _ticker;
  int _ticks = 0;
  bool _busy = false;

  bool _muted = false;
  bool _cameraOn = true;
  bool _speaker = false;
  bool _revealed = false; // görüntülü aramada karşı taraf bulanık başlar
  bool _lowBalance = false;
  final List<_FloatingGift> _floating = [];

  @override
  void initState() {
    super.initState();
    _call = widget.initial;
    _sub = ref.read(realtimeProvider).events.listen(_onEvent);
    if (_call == null) _refresh();
    if (_call?.status == CallStatus.active) _startMedia(_call!);
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _ticks++);
      // Olay kaçırılırsa (bağlantı kısa süre koptuysa) durumu sunucudan tazele
      if (_ticks % 5 == 0 && (_call?.isLive ?? true)) _refresh();
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _ticker?.cancel();
    _media?.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      _apply(await ref.read(apiProvider).call(widget.callId));
    } catch (_) {}
  }

  // Sunucudan gelen güncel durumu uygula; görüşme başladıysa medyayı aç, bittiyse kapat
  void _apply(CallInfo next) {
    if (!mounted) return;
    final wasActive = _call?.status == CallStatus.active;
    setState(() => _call = next);
    if (next.status == CallStatus.active && (!wasActive || _media == null)) _startMedia(next);
    if (!next.isLive) {
      _media?.dispose();
      _media = null;
      ref.invalidate(callHistoryProvider);
      ref.invalidate(walletProvider);
    }
  }

  Future<void> _startMedia(CallInfo call) async {
    if (_media != null) return;
    final media = CallMediaEngine(call.media);
    _media = media;
    _speaker = call.isVideo;
    media.remoteJoined.addListener(() {
      if (mounted) setState(() {});
    });
    try {
      await media.start(media: call.media, video: call.isVideo);
    } catch (e) {
      debugPrint('media start failed: $e');
    }
    if (mounted) setState(() {});
  }

  void _onEvent(RealtimeEvent e) {
    final data = e.data is Map ? Map<String, dynamic>.from(e.data as Map) : const <String, dynamic>{};
    final id = data['id'] ?? data['callId'];
    if (id != widget.callId) return;
    switch (e.name) {
      case 'call:accepted':
      case 'call:charged':
      case 'call:ended':
        _apply(CallInfo.fromJson(data));
        if (e.name == 'call:charged') ref.invalidate(walletProvider);
      case 'call:low_balance':
        setState(() => _lowBalance = true);
      case 'call:gift':
        final mine = data['fromId'] == ref.read(sessionProvider).value?.userId;
        _showGift(data['emoji'] as String);
        ref.invalidate(walletProvider);
        if (!mine) {
          final l = AppLocalizations.of(context);
          showSnack(context, l.giftReceived(data['emoji'] as String, data['coins'] as int));
        }
        _refresh();
    }
  }

  Future<void> _run(Future<CallInfo> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      _apply(await action());
    } catch (e) {
      if (mounted) showSnack(context, errorText(AppLocalizations.of(context), e));
      await _refresh();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _accept() => _run(() => ref.read(apiProvider).acceptCall(widget.callId));
  void _hangUp() => _run(() => ref.read(apiProvider).hangUp(widget.callId));

  // Arama içinden "bildir ve kapat": arama hemen biter, şikayet öncelikli incelenir
  Future<void> _reportAndEnd() async {
    final l = AppLocalizations.of(context);
    final reason = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(l.reportAndEndTitle, style: Theme.of(ctx).textTheme.titleMedium),
          ),
          for (final (id, label) in [
            ('inappropriate_content', l.reportInappropriate),
            ('harassment', l.reportHarassment),
            ('underage', l.reportUnderage),
            ('scam', l.reportScam),
            ('fake_profile', l.reportFake),
            ('other', l.reportOther),
          ])
            ListTile(title: Text(label), onTap: () => Navigator.pop(ctx, id)),
        ]),
      ),
    );
    if (reason == null || !mounted) return;
    await _run(() => ref.read(apiProvider).reportCall(widget.callId, reason));
    if (mounted) showSnack(context, l.reportSent);
  }

  void _close() => context.canPop() ? context.pop() : context.go('/discover');

  void _showGift(String emoji) {
    final gift = _FloatingGift(emoji, UniqueKey());
    setState(() => _floating.add(gift));
    Future.delayed(const Duration(milliseconds: 1600), () {
      if (mounted) setState(() => _floating.remove(gift));
    });
  }

  Future<void> _openGifts() async {
    final l = AppLocalizations.of(context);
    final gift = await showModalBottomSheet<GiftOption>(context: context, builder: (_) => const _GiftSheet());
    if (gift == null || !mounted) return;
    try {
      await ref.read(apiProvider).sendGift(widget.callId, gift.id);
      ref.invalidate(walletProvider);
      if (mounted) showSnack(context, l.giftSent(gift.emoji));
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final call = _call;
    return PopScope(
      canPop: call == null || !call.isLive,
      child: Scaffold(
        backgroundColor: const Color(0xFF120E16),
        body: call == null
            ? const Center(child: CircularProgressIndicator())
            : call.isLive
                ? _live(call)
                : _CallSummary(call: call, onClose: _close),
      ),
    );
  }

  Widget _live(CallInfo call) {
    final l = AppLocalizations.of(context);
    final active = call.status == CallStatus.active;
    final showVideo = active && call.isVideo;
    final media = _media;

    return Stack(fit: StackFit.expand, children: [
      // Arka plan: görüntülüde karşı tarafın görüntüsü, değilse bulanık profil fotoğrafı
      if (showVideo)
        _RemoteVideo(
          profile: call.user,
          view: media?.remoteView(),
          joined: media?.remoteJoined.value ?? false,
          revealed: _revealed,
          onReveal: () => setState(() => _revealed = true),
        )
      else
        _BlurredBackdrop(profile: call.user),

      SafeArea(
        child: Column(children: [
          _TopBar(call: call, simulated: active && media != null && !media.isReal, onReport: active && !_busy ? _reportAndEnd : null),
          if (_lowBalance && call.outgoing && active)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: _Banner(icon: Icons.hourglass_bottom_rounded, text: l.lowBalanceWarning),
            ),
          Expanded(
            child: showVideo
                ? const SizedBox.shrink()
                : _CallerHero(call: call, ringing: !active),
          ),
          if (active) _activeControls(call) else _ringingControls(call),
          const SizedBox(height: 24),
        ]),
      ),

      // Kendi kameran (görüntülü aramada sağ üst köşe)
      if (showVideo)
        Positioned(
          top: MediaQuery.paddingOf(context).top + 72,
          right: 16,
          child: _LocalPreview(view: _cameraOn ? media?.localView() : null, cameraOn: _cameraOn),
        ),

      for (final g in _floating) _GiftBurst(key: g.key, emoji: g.emoji),
    ]);
  }

  Widget _ringingControls(CallInfo call) {
    final l = AppLocalizations.of(context);
    if (call.outgoing) {
      return _RoundButton(
        icon: Icons.call_end_rounded,
        label: l.cancel,
        color: Brand.nope,
        size: 72,
        onTap: _busy ? null : _hangUp,
      );
    }
    return Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
      _RoundButton(
        icon: Icons.call_end_rounded,
        label: l.decline,
        color: Brand.nope,
        size: 72,
        onTap: _busy ? null : _hangUp,
      ),
      _RoundButton(
        icon: callKindIcon(call.kind),
        label: l.answer,
        color: Brand.like,
        size: 72,
        onTap: _busy ? null : _accept,
      ),
    ]);
  }

  Widget _activeControls(CallInfo call) {
    final l = AppLocalizations.of(context);
    final media = _media;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
        _RoundButton(
          icon: _muted ? Icons.mic_off_rounded : Icons.mic_rounded,
          label: l.mute,
          selected: _muted,
          onTap: () {
            setState(() => _muted = !_muted);
            media?.setMuted(_muted);
          },
        ),
        if (call.isVideo) ...[
          _RoundButton(
            icon: _cameraOn ? Icons.videocam_rounded : Icons.videocam_off_rounded,
            label: l.camera,
            selected: !_cameraOn,
            onTap: () {
              setState(() => _cameraOn = !_cameraOn);
              media?.setCameraOn(_cameraOn);
            },
          ),
          _RoundButton(icon: Icons.cameraswitch_rounded, label: l.flipCamera, onTap: () => media?.switchCamera()),
        ] else
          _RoundButton(
            icon: _speaker ? Icons.volume_up_rounded : Icons.volume_down_rounded,
            label: l.speaker,
            selected: _speaker,
            onTap: () {
              setState(() => _speaker = !_speaker);
              media?.setSpeaker(_speaker);
            },
          ),
        _RoundButton(icon: Icons.card_giftcard_rounded, label: l.gift, color: Brand.gold, onTap: _openGifts),
        _RoundButton(
          icon: Icons.call_end_rounded,
          label: l.endCall,
          color: Brand.nope,
          onTap: _busy ? null : _hangUp,
        ),
      ]),
    );
  }
}

class _FloatingGift {
  _FloatingGift(this.emoji, this.key);
  final String emoji;
  final Key key;
}

// Üst çubuk: isim, süre ve harcanan/kazanılan jeton
class _TopBar extends StatelessWidget {
  const _TopBar({required this.call, required this.simulated, this.onReport});
  final CallInfo call;
  final bool simulated;
  final VoidCallback? onReport;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final active = call.status == CallStatus.active;
    final white = Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(children: [
        Row(children: [
          Icon(callKindIcon(call.kind), color: Colors.white70, size: 18),
          const SizedBox(width: 8),
          if (active) ...[
            Expanded(
              child: NameWithBadge(call.user?.displayName ?? '', verified: call.user?.verified ?? false, style: white),
            ),
            Text(formatCallTime(call.talkTime),
                style: white?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            if (onReport != null)
              IconButton(
                tooltip: l.reportAndEnd,
                icon: const Icon(Icons.flag_rounded, color: Colors.white),
                onPressed: onReport,
              ),
          ] else
            Expanded(
              child: Text(callKindLabel(l, call.kind), style: white?.copyWith(color: Colors.white70)),
            ),
        ]),
        if (active) ...[
          const SizedBox(height: 8),
          Row(children: [
            _Pill(coin: true, label: call.outgoing ? '-${call.totalCoins}' : '+${call.totalCoins}'),
            const SizedBox(width: 8),
            _Pill(label: l.perMinute(call.ratePerMin)),
            const Spacer(),
            if (simulated) _Pill(label: l.simulationMode, dim: true),
          ]),
        ],
      ]),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, this.coin = false, this.dim = false});
  final String label;
  final bool coin;
  final bool dim;

  @override
  Widget build(BuildContext context) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.35), borderRadius: BorderRadius.circular(20)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (coin) ...[const Icon(Icons.toll_rounded, size: 15, color: Brand.gold), const SizedBox(width: 5)],
            Text(
              label,
              style: TextStyle(color: dim ? Colors.white60 : Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ]),
        );
}

class _Banner extends StatelessWidget {
  const _Banner({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: Brand.gold.withValues(alpha: 0.92), borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          Icon(icon, size: 18, color: Colors.black87),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(color: Colors.black87, fontSize: 13))),
        ]),
      );
}

// Ortadaki büyük profil fotoğrafı; çalarken nabız halkası
class _CallerHero extends StatefulWidget {
  const _CallerHero({required this.call, required this.ringing});
  final CallInfo call;
  final bool ringing;

  @override
  State<_CallerHero> createState() => _CallerHeroState();
}

class _CallerHeroState extends State<_CallerHero> with SingleTickerProviderStateMixin {
  late final _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final call = widget.call;
    final status = !widget.ringing
        ? formatCallTime(call.talkTime)
        : call.outgoing
            ? l.calling
            : l.isCallingYou;
    final rateLine = widget.ringing
        ? (call.outgoing ? l.perMinute(call.ratePerMin) : l.earnPerMinute(call.ratePerMin))
        : null;

    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        SizedBox.square(
          dimension: 190,
          child: Stack(alignment: Alignment.center, children: [
            if (widget.ringing)
              AnimatedBuilder(
                animation: _pulse,
                builder: (_, _) => Container(
                  width: 128 + 60 * _pulse.value,
                  height: 128 + 60 * _pulse.value,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Brand.coral.withValues(alpha: 1 - _pulse.value), width: 3),
                  ),
                ),
              ),
            Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(shape: BoxShape.circle, gradient: Brand.gradient),
              child: Avatar(call.user, radius: 62),
            ),
          ]),
        ),
        const SizedBox(height: 16),
        NameWithBadge(
          call.user?.displayName ?? '',
          verified: call.user?.verified ?? false,
          style: theme.textTheme.headlineSmall?.copyWith(color: Colors.white),
        ),
        const SizedBox(height: 6),
        Text(status, style: theme.textTheme.titleMedium?.copyWith(color: Colors.white70)),
        if (rateLine != null) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.toll_rounded, size: 16, color: Brand.gold),
              const SizedBox(width: 6),
              Text(rateLine, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            ]),
          ),
        ],
      ]),
    );
  }
}

class _BlurredBackdrop extends StatelessWidget {
  const _BlurredBackdrop({required this.profile});
  final PublicProfile? profile;

  @override
  Widget build(BuildContext context) => Stack(fit: StackFit.expand, children: [
        ImageFiltered(
          imageFilter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
          child: NetPhoto(profile?.coverUrl),
        ),
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.black.withValues(alpha: 0.55), Colors.black.withValues(alpha: 0.8)],
            ),
          ),
        ),
      ]);
}

// Karşı tarafın görüntüsü. Güvenlik için bulanık başlar; kullanıcı dokununca netleşir.
// Simülasyonda gerçek görüntü yerine profil fotoğrafı gösterilir.
class _RemoteVideo extends StatelessWidget {
  const _RemoteVideo({
    required this.profile,
    required this.view,
    required this.joined,
    required this.revealed,
    required this.onReveal,
  });
  final PublicProfile? profile;
  final Widget? view;
  final bool joined;
  final bool revealed;
  final VoidCallback onReveal;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final content = view ?? NetPhoto(profile?.coverUrl);
    if (!joined) {
      return Stack(fit: StackFit.expand, children: [
        _BlurredBackdrop(profile: profile),
        Center(child: Text(l.waitingVideo, style: const TextStyle(color: Colors.white70))),
      ]);
    }
    return Stack(fit: StackFit.expand, children: [
      AnimatedSwitcher(
        duration: const Duration(milliseconds: 400),
        child: revealed
            ? SizedBox.expand(key: const ValueKey('clear'), child: content)
            : ImageFiltered(
                key: const ValueKey('blur'),
                imageFilter: ImageFilter.blur(sigmaX: 28, sigmaY: 28),
                child: SizedBox.expand(child: content),
              ),
      ),
      // Kontrollerin okunması için alt ve üst gölge
      const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: [0, 0.2, 0.7, 1],
            colors: [Colors.black54, Colors.transparent, Colors.transparent, Colors.black87],
          ),
        ),
      ),
      if (!revealed)
        Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.blur_on_rounded, color: Colors.white, size: 40),
            const SizedBox(height: 10),
            Text(l.videoBlurred, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            const SizedBox(height: 14),
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: Colors.black87),
              onPressed: onReveal,
              icon: const Icon(Icons.visibility_rounded, size: 18),
              label: Text(l.revealVideo),
            ),
          ]),
        ),
    ]);
  }
}

class _LocalPreview extends StatelessWidget {
  const _LocalPreview({required this.view, required this.cameraOn});
  final Widget? view;
  final bool cameraOn;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: 96,
          height: 136,
          decoration: BoxDecoration(
            color: const Color(0xFF2A2430),
            border: Border.all(color: Colors.white24),
            borderRadius: BorderRadius.circular(14),
          ),
          child: view ??
              Icon(cameraOn ? Icons.person_rounded : Icons.videocam_off_rounded, color: Colors.white38, size: 36),
        ),
      );
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.icon,
    required this.label,
    this.onTap,
    this.color,
    this.selected = false,
    this.size = 56,
  });
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Color? color;
  final bool selected;
  final double size;

  @override
  Widget build(BuildContext context) {
    final bg = color ?? (selected ? Colors.white : Colors.white.withValues(alpha: 0.16));
    final fg = color != null ? Colors.white : (selected ? Colors.black87 : Colors.white);
    return Semantics(
      button: true,
      label: label,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Material(
          color: bg,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox.square(dimension: size, child: Icon(icon, color: fg, size: size * 0.44)),
          ),
        ),
        const SizedBox(height: 6),
        ExcludeSemantics(
          child: Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w500)),
        ),
      ]),
    );
  }
}

// Gönderilen/alınan hediye: alttan küçük bir emoji yükselip kaybolur
class _GiftBurst extends StatefulWidget {
  const _GiftBurst({super.key, required this.emoji});
  final String emoji;

  @override
  State<_GiftBurst> createState() => _GiftBurstState();
}

class _GiftBurstState extends State<_GiftBurst> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, _) {
          final t = Curves.easeOut.transform(_c.value);
          return Positioned(
            left: 0,
            right: 0,
            bottom: 140 + 180 * t,
            child: IgnorePointer(
              child: Opacity(
                opacity: (1 - _c.value).clamp(0, 1) * (_c.value < 0.1 ? _c.value * 10 : 1),
                child: Center(
                  child: Transform.scale(
                    scale: 0.6 + 0.6 * Curves.elasticOut.transform((_c.value * 2).clamp(0, 1)),
                    child: Text(widget.emoji, style: const TextStyle(fontSize: 56)),
                  ),
                ),
              ),
            ),
          );
        },
      );
}

class _GiftSheet extends ConsumerWidget {
  const _GiftSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final wallet = ref.watch(walletProvider).value;
    final gifts = wallet?.gifts ?? const <GiftOption>[];
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(l.sendGiftTitle, style: theme.textTheme.titleLarge)),
            if (wallet != null) CoinAmount(wallet.balance, style: const TextStyle(fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 4),
          Text(l.giftInfo, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 16),
          Row(children: [
            for (final g in gifts)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Material(
                    color: theme.colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(Brand.radius),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(Brand.radius),
                      onTap: (wallet?.balance ?? 0) >= g.coins ? () => Navigator.pop(context, g) : null,
                      child: Opacity(
                        opacity: (wallet?.balance ?? 0) >= g.coins ? 1 : 0.4,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          child: Column(children: [
                            Text(g.emoji, style: const TextStyle(fontSize: 34)),
                            const SizedBox(height: 6),
                            CoinAmount(g.coins, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          ]),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ]),
        ]),
      ),
    );
  }
}

// Arama bittikten sonra: özet, puanlama ve isteğe bağlı sorun bildirimi
class _CallSummary extends ConsumerStatefulWidget {
  const _CallSummary({required this.call, required this.onClose});
  final CallInfo call;
  final VoidCallback onClose;

  @override
  ConsumerState<_CallSummary> createState() => _CallSummaryState();
}

class _CallSummaryState extends ConsumerState<_CallSummary> {
  int _rating = 0;
  bool _reporting = false;
  String? _reason;
  bool _sending = false;

  static const _reasons = ['harassment', 'inappropriate_content', 'fake_profile', 'scam', 'underage', 'other'];

  String _reasonLabel(AppLocalizations l, String r) => switch (r) {
        'harassment' => l.reportHarassment,
        'inappropriate_content' => l.reportInappropriate,
        'fake_profile' => l.reportFake,
        'scam' => l.reportScam,
        'underage' => l.reportUnderage,
        _ => l.reportOther,
      };

  Future<void> _submit() async {
    setState(() => _sending = true);
    try {
      await ref.read(apiProvider).rateCall(widget.call.id, _rating, reportReason: _reporting ? _reason : null);
      ref.invalidate(callHistoryProvider);
      if (!mounted) return;
      if (_reporting && _reason != null) showSnack(context, AppLocalizations.of(context).reportSent);
      widget.onClose();
    } catch (e) {
      if (mounted) showSnack(context, errorText(AppLocalizations.of(context), e));
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final call = widget.call;
    final talked = call.status == CallStatus.ended && call.answeredAt != null;
    final canRate = talked && call.myRating == null;

    final title = switch (call.status) {
      CallStatus.missed => call.outgoing ? l.callNoAnswer : l.callMissed,
      CallStatus.declined => l.callDeclined,
      CallStatus.cancelled => l.callCancelled,
      _ => l.callEnded,
    };
    final reasonText = switch (call.endReason) {
      'balance' => l.callEndedBalance,
      'disconnect' => l.callEndedDisconnect,
      _ => null,
    };
    final coins = call.totalCoins;
    final white = theme.textTheme.bodyMedium?.copyWith(color: Colors.white70);

    return Stack(fit: StackFit.expand, children: [
      _BlurredBackdrop(profile: call.user),
      SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Avatar(call.user, radius: 44),
                const SizedBox(height: 12),
                Text(call.user?.displayName ?? '', style: theme.textTheme.titleLarge?.copyWith(color: Colors.white)),
                const SizedBox(height: 4),
                Text(title, style: white),
                if (reasonText != null) ...[
                  const SizedBox(height: 8),
                  Text(reasonText, style: white, textAlign: TextAlign.center),
                ],
                if (talked) ...[
                  const SizedBox(height: 16),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(Icons.schedule_rounded, color: Colors.white70, size: 18),
                    const SizedBox(width: 6),
                    Text(formatCallTime(call.talkTime), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                    const SizedBox(width: 18),
                    CoinAmount(
                      call.outgoing ? -coins : coins,
                      signed: true,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                  ]),
                ],
                const SizedBox(height: 28),
                if (canRate)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(children: [
                        Text(l.rateCallTitle, style: theme.textTheme.titleMedium),
                        const SizedBox(height: 8),
                        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          for (var i = 1; i <= 5; i++)
                            // Etiket sadece ekran okuyucu için (üstüne gelince baloncuk çıkmasın)
                            Semantics(
                              label: '$i',
                              button: true,
                              child: IconButton(
                                onPressed: () => setState(() => _rating = i),
                                icon: Icon(
                                  i <= _rating ? Icons.star_rounded : Icons.star_outline_rounded,
                                  color: Brand.gold,
                                  size: 34,
                                ),
                              ),
                            ),
                        ]),
                        if (!_reporting)
                          TextButton.icon(
                            onPressed: () => setState(() => _reporting = true),
                            icon: const Icon(Icons.flag_outlined, size: 18),
                            label: Text(l.reportProblem),
                          )
                        else ...[
                          const SizedBox(height: 8),
                          Wrap(spacing: 6, runSpacing: 6, alignment: WrapAlignment.center, children: [
                            for (final r in _reasons)
                              ChoiceChip(
                                label: Text(_reasonLabel(l, r)),
                                selected: _reason == r,
                                onSelected: (v) => setState(() => _reason = v ? r : null),
                              ),
                          ]),
                        ],
                        const SizedBox(height: 12),
                        Row(children: [
                          Expanded(child: TextButton(onPressed: widget.onClose, child: Text(l.skip))),
                          const SizedBox(width: 8),
                          Expanded(
                            child: FilledButton(
                              onPressed: _rating == 0 || _sending ? null : _submit,
                              child: Text(l.send),
                            ),
                          ),
                        ]),
                      ]),
                    ),
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(onPressed: widget.onClose, child: Text(l.done)),
                  ),
              ]),
            ),
          ),
        ),
      ),
    ]);
  }
}
