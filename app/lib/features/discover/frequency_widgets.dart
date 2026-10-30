import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/catalog.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';

// Faz 24: "uyum frekansı" ve moda özel kart görünümleri. Sunucu her kart için 40-98 arası tek bir sayı ve
// parçalarını (ilgi alanı, burç, müzik, vibe, ne aradığı) gönderir; kart üstünde halka olarak görünür.

// ------------------------------------------------------------------ Frekans halkası
class FrequencyRing extends StatelessWidget {
  const FrequencyRing({super.key, required this.frequency, this.size = 52, this.onTap});
  final Frequency frequency;
  final double size;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Semantics(
      button: onTap != null,
      label: l.frequencyLabel(frequency.score),
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        onTap: onTap,
        child: TweenAnimationBuilder<double>(
          key: ValueKey(frequency.score),
          tween: Tween(begin: 0, end: frequency.score / 100),
          duration: const Duration(milliseconds: 1100),
          curve: Curves.easeOutCubic,
          builder: (_, t, _) => SizedBox(
            width: size,
            height: size,
            child: CustomPaint(
              painter: _RingPainter(progress: t),
              child: Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('${(t * 100).round()}', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: size * 0.34, height: 1)),
                  Text('frekans', style: TextStyle(color: Colors.white70, fontSize: size * 0.15, height: 1.1, fontWeight: FontWeight.w700)),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress});
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final c = rect.center;
    final r = size.width / 2 - 3;
    // Cam zemin
    canvas.drawCircle(c, size.width / 2, Paint()..color = Colors.black.withValues(alpha: 0.42));
    canvas.drawCircle(c, r, Paint()..style = PaintingStyle.stroke..strokeWidth = 4..color = Colors.white.withValues(alpha: 0.16));
    final sweep = 2 * math.pi * progress;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.5
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        startAngle: -math.pi / 2,
        endAngle: -math.pi / 2 + 2 * math.pi,
        colors: [Brand.coral, Brand.orange, const Color(0xFFFFD36B), Brand.coral],
        transform: const GradientRotation(-math.pi / 2),
      ).createShader(rect);
    canvas.drawArc(Rect.fromCircle(center: c, radius: r), -math.pi / 2, sweep, false, paint);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress;
}

// ------------------------------------------------------------------ Neden bu frekans?
Future<void> showFrequencySheet(BuildContext context, PublicProfile profile) {
  final l = AppLocalizations.of(context);
  final theme = Theme.of(context);
  final f = profile.frequency;
  if (f == null) return Future.value();
  final rows = <(String, IconData, int)>[
    if (f.parts['interests'] != null) (l.frequencyPartInterests, Icons.interests_outlined, f.parts['interests']!),
    if (f.parts['astro'] != null) (l.frequencyPartAstro, Icons.auto_awesome_outlined, f.parts['astro']!),
    if (f.parts['music'] != null) (l.frequencyPartMusic, Icons.headphones_outlined, f.parts['music']!),
    if (f.parts['vibe'] != null) (l.frequencyPartVibe, Icons.waves_rounded, f.parts['vibe']!),
    if (f.parts['intent'] != null) (l.frequencyPartIntent, Icons.favorite_border_rounded, f.parts['intent']!),
  ];
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 0, 22, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 62,
              height: 62,
              decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.black.withValues(alpha: 0.85)),
              child: Center(child: FrequencyRing(frequency: f, size: 62)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(l.frequencySheetTitle(f.score), style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                Text(l.frequencySheetBody(profile.displayName), style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              ]),
            ),
          ]),
          const SizedBox(height: 18),
          for (final (label, icon, value) in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(children: [
                Icon(icon, size: 20, color: Brand.coral),
                const SizedBox(width: 10),
                SizedBox(width: 118, child: Text(label, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700))),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(value: value / 100, minHeight: 8, color: Brand.coral, backgroundColor: Brand.coral.withValues(alpha: 0.16)),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(width: 38, child: Text('%$value', textAlign: TextAlign.right, style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w900))),
              ]),
            ),
          const SizedBox(height: 10),
          Text(l.frequencyFootnote, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        ]),
      ),
    ),
  );
}

// Vibe arketipinden türetilen sabit aura rengi (arketip yoksa marka rengi). Kartta ve eşleşme anında aynı renk.
Color auraColorFor(String archetypeId) {
  if (archetypeId.isEmpty) return Brand.coral;
  final h = archetypeId.codeUnits.fold<int>(7, (a, b) => (a * 31 + b) & 0x7fffffff) % 360;
  return HSLColor.fromAHSL(1, h.toDouble(), 0.78, 0.6).toColor();
}

// ------------------------------------------------------------------ Moda özel kart görünümü
// Keşfet modu "Tümü" dışındaysa kartın üstüne o moda ait hafif, hareketli bir katman biner:
// Astroloji: yıldız alanı · Müzik: ekolayzır · İlgi: yüzen baloncuklar · Vibe: nefes alan aura.
class ModeSkin extends StatefulWidget {
  const ModeSkin({super.key, required this.mode, required this.profile});
  final String mode;
  final PublicProfile profile;

  @override
  State<ModeSkin> createState() => _ModeSkinState();
}

class _ModeSkinState extends State<ModeSkin> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 7))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Color get _aura => auraColorFor(widget.profile.vibeArchetypeId);

  @override
  Widget build(BuildContext context) {
    final p = widget.profile;
    final seed = p.id.codeUnits.fold<int>(0, (a, b) => (a * 31 + b) & 0x7fffffff);
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, _) {
          switch (widget.mode) {
            case 'astro':
              final sign = p.zodiac;
              return Stack(fit: StackFit.expand, children: [
                DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [const Color(0xFF1B1464).withValues(alpha: 0.35), Colors.transparent]))),
                CustomPaint(painter: _StarsPainter(seed: seed, t: _c.value)),
                if (sign.isNotEmpty)
                  Positioned(
                    right: 18,
                    top: 96,
                    child: Text(zodiacSymbol[sign] ?? '', style: TextStyle(fontSize: 96, color: Colors.white.withValues(alpha: 0.16), fontWeight: FontWeight.w300)),
                  ),
              ]);
            case 'music':
              return Align(
                alignment: Alignment.bottomCenter,
                child: SizedBox(height: 150, width: double.infinity, child: CustomPaint(painter: _EqualizerPainter(seed: seed, t: _c.value, color: Brand.coral))),
              );
            case 'interests':
              return CustomPaint(painter: _BubblesPainter(seed: seed, t: _c.value, color: Brand.coral));
            case 'vibe':
              final pulse = 0.5 + 0.5 * math.sin(_c.value * 2 * math.pi);
              final a = _aura;
              return DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: a.withValues(alpha: 0.55 + 0.35 * pulse), width: 3),
                  boxShadow: [BoxShadow(color: a.withValues(alpha: 0.30 + 0.25 * pulse), blurRadius: 28 + 16 * pulse, spreadRadius: -2)],
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(28),
                    gradient: RadialGradient(center: const Alignment(0, 0.9), radius: 1.1, colors: [a.withValues(alpha: 0.28 + 0.1 * pulse), Colors.transparent]),
                  ),
                ),
              );
            default:
              return const SizedBox.shrink();
          }
        },
      ),
    );
  }
}

class _StarsPainter extends CustomPainter {
  _StarsPainter({required this.seed, required this.t});
  final int seed;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final rnd = math.Random(seed);
    final paint = Paint();
    for (var i = 0; i < 46; i++) {
      final x = rnd.nextDouble() * size.width;
      final y = rnd.nextDouble() * size.height * 0.75;
      final base = 0.25 + rnd.nextDouble() * 0.5;
      final tw = 0.5 + 0.5 * math.sin((t + rnd.nextDouble()) * 2 * math.pi);
      paint.color = Colors.white.withValues(alpha: (base * (0.4 + 0.6 * tw)).clamp(0.0, 1.0));
      canvas.drawCircle(Offset(x, y), 0.8 + rnd.nextDouble() * 1.6, paint);
    }
  }

  @override
  bool shouldRepaint(_StarsPainter old) => old.t != t;
}

class _EqualizerPainter extends CustomPainter {
  _EqualizerPainter({required this.seed, required this.t, required this.color});
  final int seed;
  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rnd = math.Random(seed);
    const bars = 26;
    final w = size.width / bars;
    for (var i = 0; i < bars; i++) {
      final phase = rnd.nextDouble();
      final amp = 0.25 + rnd.nextDouble() * 0.75;
      final h = size.height * 0.85 * amp * (0.35 + 0.65 * (0.5 + 0.5 * math.sin((t * 3 + phase) * 2 * math.pi)));
      final rect = RRect.fromRectAndRadius(Rect.fromLTWH(i * w + w * 0.2, size.height - h, w * 0.6, h), const Radius.circular(3));
      canvas.drawRRect(
        rect,
        Paint()
          ..shader = LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [color.withValues(alpha: 0.55), color.withValues(alpha: 0.0)]).createShader(rect.outerRect),
      );
    }
  }

  @override
  bool shouldRepaint(_EqualizerPainter old) => old.t != t;
}

class _BubblesPainter extends CustomPainter {
  _BubblesPainter({required this.seed, required this.t, required this.color});
  final int seed;
  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rnd = math.Random(seed);
    for (var i = 0; i < 14; i++) {
      final x = rnd.nextDouble() * size.width;
      final speed = 0.5 + rnd.nextDouble();
      final phase = rnd.nextDouble();
      final r = 6 + rnd.nextDouble() * 18;
      final p = (t * speed + phase) % 1.0;
      final y = size.height * (1.05 - p * 1.1);
      final sway = math.sin((t + phase) * 2 * math.pi) * 10;
      final a = (math.sin(p * math.pi)).clamp(0.0, 1.0);
      canvas.drawCircle(Offset(x + sway, y), r, Paint()..color = color.withValues(alpha: 0.10 * a));
      canvas.drawCircle(Offset(x + sway, y), r, Paint()..style = PaintingStyle.stroke..strokeWidth = 1.4..color = Colors.white.withValues(alpha: 0.35 * a));
    }
  }

  @override
  bool shouldRepaint(_BubblesPainter old) => old.t != t;
}
