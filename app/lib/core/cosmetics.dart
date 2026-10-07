import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'catalog.dart';

// Faz 20: sohbet kozmetikleri (mağazadan alınan balon stili ve arka plan) — sohbet ekranı ve
// mağaza önizlemeleri aynı bileşenleri kullanır, böylece "gördüğün = aldığın".

// Arka plan: gradyan + (varsa) sönük, döşenmiş emoji deseni. `style` null ise sadece child.
class ChatBackdrop extends StatelessWidget {
  const ChatBackdrop({super.key, required this.style, required this.child});
  final ChatBackdropStyle? style;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final s = style;
    if (s == null) return child;
    return DecoratedBox(
      decoration: BoxDecoration(gradient: s.gradient),
      child: Stack(children: [
        if (s.pattern != null)
          Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _PatternPainter(s.pattern!, dark: s.dark)))),
        child,
      ]),
    );
  }
}

class _PatternPainter extends CustomPainter {
  _PatternPainter(this.glyph, {required this.dark});
  final String glyph;
  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    final painter = TextPainter(
      text: TextSpan(
        text: glyph,
        style: TextStyle(fontSize: 20, color: (dark ? Colors.white : Colors.black).withValues(alpha: dark ? 0.12 : 0.07)),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    const step = 56.0;
    final rows = (size.height / step).ceil() + 1;
    final cols = (size.width / step).ceil() + 1;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        // Satırları kaydırıp biraz oynatarak doğal bir desen
        final dx = c * step + (r.isOdd ? step / 2 : 0) + math.sin(r * 12.9 + c * 78.2) * 6;
        final dy = r * step + math.cos(r * 39.3 + c * 11.1) * 6;
        painter.paint(canvas, Offset(dx, dy));
      }
    }
  }

  @override
  bool shouldRepaint(_PatternPainter old) => old.glyph != glyph || old.dark != dark;
}

// Mağaza kartlarında ve seçicilerde: "Selam" balonu + karşı taraf balonu mini önizlemesi
class MiniChatPreview extends StatelessWidget {
  const MiniChatPreview({super.key, this.bubble, this.backdrop, this.height = 84});
  final ChatBubbleStyle? bubble;
  final ChatBackdropStyle? backdrop;
  final double height;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    Widget bubbleBox({required bool mine}) {
      final style = mine ? bubble : null;
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          gradient: mine ? (style?.gradient ?? const LinearGradient(colors: [Color(0xFFFF4D6D), Color(0xFFFF8A5B)])) : null,
          color: mine ? null : scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12).copyWith(
            bottomRight: mine ? const Radius.circular(3) : null,
            bottomLeft: mine ? null : const Radius.circular(3),
          ),
        ),
        child: Text(
          mine ? '😍 …' : '👋',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: mine ? (style?.text ?? Colors.white) : scheme.onSurface),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: ChatBackdrop(
        style: backdrop,
        child: Container(
          height: height,
          color: backdrop == null ? scheme.surfaceContainerLow : null,
          padding: const EdgeInsets.all(10),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Align(alignment: Alignment.centerLeft, child: bubbleBox(mine: false)),
            const SizedBox(height: 6),
            Align(alignment: Alignment.centerRight, child: bubbleBox(mine: true)),
          ]),
        ),
      ),
    );
  }
}
