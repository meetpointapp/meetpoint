import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';

// Faz 24: "frekans yakalama" — karta basılı tutunca halka dolar, bırakınca o güçte beğeni gider.
// Kademeler: 1 merak (normal beğeni) · 2 ilgi (karşı tarafa "ilgi gösterdi") · 3 tutku (süper beğeni).
const captureStartMs = 420; // bundan kısa dokunuş normal dokunuştur (fotoğraf değiştirir)
const captureTier2Ms = 1200;
const captureTier3Ms = 2000;

int captureTier(int ms) => ms < captureStartMs ? 0 : ms < captureTier2Ms ? 1 : ms < captureTier3Ms ? 2 : 3;

class CaptureOverlay extends StatelessWidget {
  const CaptureOverlay({super.key, required this.ms});
  final int ms;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final tier = captureTier(ms);
    final progress = ((ms - captureStartMs) / (captureTier3Ms - captureStartMs)).clamp(0.0, 1.0);
    final color = switch (tier) { 1 => Brand.coral, 2 => Brand.orange, _ => Brand.gold };
    final label = switch (tier) { 1 => l.captureMerak, 2 => l.captureInterest, _ => l.capturePassion };
    final icon = switch (tier) { 1 => Icons.favorite_border_rounded, 2 => Icons.favorite_rounded, _ => Icons.star_rounded };
    final pulse = tier == 3 ? 0.5 + 0.5 * math.sin(ms / 90) : 0.0;
    return IgnorePointer(
      child: Stack(fit: StackFit.expand, children: [
        // Kartın etrafında kademeye göre renk alan, güçlenen parıltı
        DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            color: Colors.black.withValues(alpha: 0.12 + 0.28 * progress),
            border: Border.all(color: color.withValues(alpha: 0.5 + 0.4 * progress), width: 3 + 2 * progress),
            boxShadow: [BoxShadow(color: color.withValues(alpha: 0.25 + 0.3 * progress + 0.15 * pulse), blurRadius: 30, spreadRadius: -4)],
          ),
        ),
        Align(
          alignment: const Alignment(0, -0.32), // isim ve bilgi satırlarının üstünde kalsın
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            SizedBox(
              width: 128 + 10 * pulse,
              height: 128 + 10 * pulse,
              child: CustomPaint(
                painter: _CapturePainter(progress: progress, color: color),
                child: Center(child: Icon(icon, color: Colors.white, size: 46 + 6 * pulse)),
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
              decoration: ShapeDecoration(shape: const StadiumBorder(), color: color),
              child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18, letterSpacing: 0.4)),
            ),
            if (tier == 3) ...[
              const SizedBox(height: 8),
              Text(l.capturePassionNote, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700, fontSize: 13)),
            ],
          ]),
        ),
      ]),
    );
  }
}

class _CapturePainter extends CustomPainter {
  _CapturePainter({required this.progress, required this.color});
  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 6;
    canvas.drawCircle(c, size.width / 2, Paint()..color = Colors.black.withValues(alpha: 0.45));
    const gap = 0.16;
    const seg = (2 * math.pi - 3 * gap) / 3;
    for (var i = 0; i < 3; i++) {
      final start = -math.pi / 2 + i * (seg + gap);
      final part = ((progress * 3) - i).clamp(0.0, 1.0);
      final track = Paint()..style = PaintingStyle.stroke..strokeWidth = 8..strokeCap = StrokeCap.round..color = Colors.white.withValues(alpha: 0.2);
      canvas.drawArc(Rect.fromCircle(center: c, radius: r), start, seg, false, track);
      if (part > 0) {
        final fill = Paint()..style = PaintingStyle.stroke..strokeWidth = 8..strokeCap = StrokeCap.round..color = color;
        canvas.drawArc(Rect.fromCircle(center: c, radius: r), start, seg * part, false, fill);
      }
    }
  }

  @override
  bool shouldRepaint(_CapturePainter old) => old.progress != progress || old.color != color;
}
