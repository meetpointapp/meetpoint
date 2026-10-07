import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/catalog.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 20: eşleştirme modları — keşfet ekranının üstündeki düğmelerle astroloji, müzik, ilgi alanı
// veya vibe uyumuna göre öneri. "Tümü" eski davranıştır (yakınlık ve yenilik sırası).
const _modes = <(String, String)>[
  ('all', '✨'),
  ('astro', '🔮'),
  ('music', '🎧'),
  ('interests', '☕'),
  ('vibe', '🌈'),
];

String _modeLabel(AppLocalizations l, String mode) => switch (mode) {
      'astro' => l.discoverModeAstro,
      'music' => l.discoverModeMusic,
      'interests' => l.discoverModeInterests,
      'vibe' => l.discoverModeVibe,
      _ => l.discoverModeAll,
    };

class ModeBar extends StatelessWidget {
  const ModeBar({super.key, required this.mode, required this.onSelected});
  final String mode;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
        itemCount: _modes.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (id, emoji) = _modes[i];
          final on = id == mode;
          return Semantics(
            button: true,
            selected: on,
            label: _modeLabel(l, id),
            excludeSemantics: true,
            onTap: () => onSelected(id),
            child: GestureDetector(
              onTap: () => onSelected(id),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  gradient: on ? Brand.gradient : null,
                  color: on ? null : theme.cardTheme.color,
                  border: on ? null : Border.all(color: theme.colorScheme.outlineVariant),
                  boxShadow: on ? [BoxShadow(color: Brand.coral.withValues(alpha: 0.3), blurRadius: 10, offset: const Offset(0, 3))] : null,
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(emoji, style: const TextStyle(fontSize: 15)),
                  const SizedBox(width: 6),
                  Text(
                    _modeLabel(l, id),
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: on ? Colors.white : theme.colorScheme.onSurface,
                      fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }
}

// Bir modda uygun kimse kalmadığında: nedenini ve ne yapılabileceğini söyler
class ModeEmpty extends StatelessWidget {
  const ModeEmpty({super.key, required this.mode, required this.onBack});
  final String mode;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = switch (mode) {
      'astro' => l.discoverModeEmptyAstro,
      'music' => l.discoverModeEmptyMusic,
      'vibe' => l.discoverModeEmptyVibe,
      _ => l.discoverModeEmpty,
    };
    final cta = switch (mode) {
      'music' => FilledButton.tonal(onPressed: () => context.push('/me/edit'), child: Text(l.addMusicTaste)),
      'vibe' => FilledButton.tonal(onPressed: () => context.push('/vibe'), child: Text(l.takeVibeTest)),
      _ => null,
    };
    return CenteredMessage(
      icon: Icons.auto_awesome_rounded,
      text: text,
      action: Column(mainAxisSize: MainAxisSize.min, children: [
        ?cta,
        TextButton(onPressed: onBack, child: Text(l.discoverModeAll)),
      ]),
    );
  }
}

// Kartın üstünde: bu kişinin neden önerildiği ("Akrep × Aslan: kıvılcım çıkaran bir çekim")
class MatchBubble extends StatelessWidget {
  const MatchBubble({super.key, required this.match});
  final MatchInfo match;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    String zodiac(String id) => '${zodiacSymbol[id] ?? ''} ${l.zodiacLabel(id)}'.trim();
    final a = match.args.isNotEmpty ? match.args[0] : '';
    final b = match.args.length > 1 ? match.args[1] : '';
    final (title, body) = switch (match.mode) {
      'astro' => (
          match.key == 'astro_same' ? zodiac(a) : '${zodiac(a)}  ×  ${zodiac(b)}',
          l.matchReasonText(match.key, l.zodiacLabel(a), l.zodiacLabel(b)),
        ),
      'music' => (
          '🎧 ${l.discoverModeMusic}',
          l.matchReasonText(match.key, match.args.map((g) => '${musicEmoji[g] ?? ''} ${l.musicGenreLabel(g)}'.trim()).join(', '), ''),
        ),
      'interests' => (
          '☕ ${l.discoverModeInterests}',
          l.matchReasonText(match.key, match.args.map((g) => '${interestEmoji[g] ?? ''} ${l.interestLabel(g)}'.trim()).join(', '), ''),
        ),
      _ => (
          '🌈 ${l.discoverModeVibe}',
          l.vibeCompatNote(match.key == 'vibe_similar' ? 'similar' : 'complementary', l.vibeArchetypeName(a), l.vibeArchetypeName(b)),
        ),
    };
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: Colors.white.withValues(alpha: 0.16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
        const SizedBox(height: 3),
        Text(body, style: TextStyle(color: Colors.white.withValues(alpha: 0.92), fontSize: 13, height: 1.3)),
      ]),
    );
  }
}
