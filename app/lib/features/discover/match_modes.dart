import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/catalog.dart';
import '../../core/models.dart';
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
    // Tinder tarzı: sade metin sekmeleri, seçili olan ince çerçeveli hap içinde
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        itemCount: _modes.length,
        separatorBuilder: (_, _) => const SizedBox(width: 2),
        itemBuilder: (_, i) {
          final (id, _) = _modes[i];
          final on = id == mode;
          return Semantics(
            button: true,
            selected: on,
            label: _modeLabel(l, id),
            excludeSemantics: true,
            onTap: () => onSelected(id),
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onSelected(id),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  color: on ? theme.colorScheme.onSurface.withValues(alpha: 0.07) : null,
                  border: on ? Border.all(color: theme.colorScheme.onSurface.withValues(alpha: 0.18)) : null,
                ),
                child: Text(
                  _modeLabel(l, id),
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: on ? theme.colorScheme.onSurface : theme.colorScheme.onSurface.withValues(alpha: 0.62),
                    fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                  ),
                ),
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
