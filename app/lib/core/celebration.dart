import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/discover/frequency_widgets.dart';
import '../l10n/app_localizations.dart';
import 'fx.dart';
import 'models.dart';
import 'providers.dart';
import 'share_card.dart';
import 'share_templates.dart';
import 'theme.dart';
import 'ui.dart';

// Faz 16: eşleşme anı — her akışta (kaydırma, "seni beğenenler", ilgi alanı keşfi) aynı kutlama
// kalitesiyle karşılanır: güçlü haptik + kısa kutlama sesi + iki fotoğrafın uçuşarak birleştiği
// bir kart, sıradan bir bildirim çubuğu değil.
void showMatchCelebration(BuildContext context, WidgetRef ref, {required PublicProfile other, required String conversationId}) {
  Fx.frequencySync();
  final me = ref.read(meProvider).value?.profile;
  showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'match',
    barrierColor: Colors.black87,
    transitionDuration: const Duration(milliseconds: 350),
    pageBuilder: (ctx, _, _) => MatchOverlay(
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

// Eşleşme ekranı (Faz 24 "frekans" dili): iki fotoğraf kendi aura renkleriyle iki yandan gelir, ortada
// buluşunca dalga halkaları yayılır ve kalp belirir; altta uyum frekansı yazar.
class MatchOverlay extends StatefulWidget {
  const MatchOverlay({super.key, required this.me, required this.other, required this.onChat});
  final PublicProfile? me;
  final PublicProfile other;
  final VoidCallback onChat;

  @override
  State<MatchOverlay> createState() => _MatchOverlayState();
}

class _MatchOverlayState extends State<MatchOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200))..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Widget _photo(PublicProfile? p, double angle, Color aura) => Transform.rotate(
        angle: angle,
        child: Container(
          width: 120,
          height: 160,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white, width: 3),
            boxShadow: [BoxShadow(color: aura.withValues(alpha: 0.75), blurRadius: 26, spreadRadius: 1)],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(15),
            child: NetPhoto(p?.coverThumbUrl, width: 120, height: 160),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final me = widget.me;
    final other = widget.other;
    final meAura = auraColorFor(me?.vibeArchetypeId ?? '');
    final otherAura = auraColorFor(other.vibeArchetypeId);
    final score = other.frequency?.score;

    return Material(
      type: MaterialType.transparency,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            ShaderMask(
              shaderCallback: (r) => Brand.gradient.createShader(r),
              blendMode: BlendMode.srcIn,
              child: Text(l.matchFrequencyTitle,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900, color: Colors.white)),
            ),
            const SizedBox(height: 28),
            SizedBox(
              height: 230,
              width: 320,
              child: AnimatedBuilder(
                animation: _c,
                builder: (_, _) {
                  // 0→0.55: fotoğraflar yaklaşır · 0.5→1: dalgalar ve kalp
                  final approach = Curves.easeOutCubic.transform((_c.value / 0.55).clamp(0.0, 1.0));
                  final burst = ((_c.value - 0.5) / 0.5).clamp(0.0, 1.0);
                  final offset = 74 + (1 - approach) * 130;
                  return Stack(alignment: Alignment.center, clipBehavior: Clip.none, children: [
                    // Yayılan frekans dalgaları
                    for (var i = 0; i < 3; i++)
                      Builder(builder: (_) {
                        final t = ((burst * 1.4) - i * 0.28).clamp(0.0, 1.0);
                        return Container(
                          width: 40 + t * 280,
                          height: 40 + t * 280,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: Color.lerp(meAura, otherAura, i / 2)!.withValues(alpha: (1 - t) * 0.7), width: 2.5),
                          ),
                        );
                      }),
                    Transform.translate(offset: Offset(-offset, 0), child: Opacity(opacity: approach, child: _photo(me, -0.10, meAura))),
                    Transform.translate(offset: Offset(offset, 0), child: Opacity(opacity: approach, child: _photo(other, 0.10, otherAura))),
                    Transform.scale(
                      scale: Curves.elasticOut.transform(burst),
                      child: Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(shape: BoxShape.circle, gradient: Brand.gradient, boxShadow: [
                          BoxShadow(color: Brand.coral.withValues(alpha: 0.6), blurRadius: 18 + 10 * math.sin(burst * math.pi)),
                        ]),
                        child: const Icon(Icons.favorite_rounded, color: Colors.white, size: 30),
                      ),
                    ),
                  ]);
                },
              ),
            ),
            const SizedBox(height: 20),
            if (score != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(l.matchFrequencyLine(score),
                    style: theme.textTheme.titleMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
              ),
            Text(l.matchBody(other.displayName),
                textAlign: TextAlign.center, style: theme.textTheme.bodyLarge?.copyWith(color: Colors.white70)),
            const SizedBox(height: 28),
            GradientButton(label: l.sendMessage, icon: Icons.chat_bubble_rounded, onPressed: widget.onChat),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(l.keepSwiping, style: const TextStyle(color: Colors.white70)),
              ),
              TextButton.icon(
                onPressed: () => shareCardImage(context, card: matchShareCard(l, me, other), text: '${l.shareMatchTitle} ${l.shareMatchWith(other.displayName)}'),
                icon: const Icon(Icons.ios_share_rounded, size: 18, color: Colors.white70),
                label: Text(l.shareButton, style: const TextStyle(color: Colors.white70)),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}
