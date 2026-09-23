import 'package:flutter/material.dart';

import '../../core/catalog.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';

// Profil görüntüleme bileşenleri (keşfet kartı, profil sayfası, düzenleme önizlemesi)

class InterestChip extends StatelessWidget {
  const InterestChip(this.id, {super.key, this.highlighted = false, this.onPhoto = false});
  final String id;
  final bool highlighted; // ortak ilgi alanı
  final bool onPhoto; // fotoğraf üzerinde yarı saydam stil

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final Color bg;
    final Color fg;
    if (onPhoto) {
      bg = highlighted ? Brand.coral.withValues(alpha: 0.85) : Colors.black.withValues(alpha: 0.35);
      fg = Colors.white;
    } else {
      bg = highlighted ? Brand.coral.withValues(alpha: 0.14) : scheme.surfaceContainerHighest;
      fg = highlighted ? Brand.coral : scheme.onSurface;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: ShapeDecoration(shape: const StadiumBorder(), color: bg),
      child: Text(
        '${interestEmoji[id] ?? ''} ${l.interestLabel(id)}',
        style: Theme.of(context).textTheme.labelMedium?.copyWith(color: fg, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class PromptCard extends StatelessWidget {
  const PromptCard({super.key, required this.prompt});
  final ProfilePrompt prompt;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l.promptQuestion(prompt.id), style: theme.textTheme.labelLarge?.copyWith(color: Brand.coral)),
          const SizedBox(height: 6),
          Text(prompt.answer, style: theme.textTheme.titleLarge?.copyWith(height: 1.3)),
        ]),
      ),
    );
  }
}

// Temel bilgiler: boy, meslek, eğitim... küçük simgeli rozetler
class BasicsChips extends StatelessWidget {
  const BasicsChips({super.key, required this.profile, this.showBio = false});
  final PublicProfile profile;
  final bool showBio;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = profile;
    final items = <(IconData, String)>[
      if (p.lookingFor.isNotEmpty) (Icons.favorite_border_rounded, l.lookingForLabel(p.lookingFor)),
      if (p.heightCm != null) (Icons.straighten_rounded, l.heightCm(p.heightCm!)),
      if (p.job.isNotEmpty) (Icons.work_outline_rounded, p.job),
      if (p.education.isNotEmpty) (Icons.school_outlined, l.educationLabel(p.education)),
      if (p.zodiac.isNotEmpty) (Icons.auto_awesome_outlined, l.zodiacLabel(p.zodiac)),
      if (p.smoking.isNotEmpty) (Icons.smoking_rooms_outlined, '${l.smoking}: ${l.habitLabel(p.smoking)}'),
      if (p.drinking.isNotEmpty) (Icons.local_bar_outlined, '${l.drinking}: ${l.habitLabel(p.drinking)}'),
      if (p.location.isNotEmpty) (Icons.place_outlined, p.location),
    ];
    final scheme = Theme.of(context).colorScheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (showBio && p.bio.isNotEmpty) ...[
        Text(p.bio, style: Theme.of(context).textTheme.bodyLarge),
        const SizedBox(height: 12),
      ],
      if (items.isEmpty)
        Text(l.notSpecified, style: TextStyle(color: scheme.outline))
      else
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final (icon, text) in items)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: ShapeDecoration(
                shape: StadiumBorder(side: BorderSide(color: scheme.outlineVariant)),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(icon, size: 15, color: scheme.onSurfaceVariant),
                const SizedBox(width: 5),
                Text(text, style: Theme.of(context).textTheme.labelMedium),
              ]),
            ),
        ]),
    ]);
  }
}
