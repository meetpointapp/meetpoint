import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/catalog.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
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

// Izgara görünümünde beğen/geç kartı — hem "Seni beğenenler" hem de ilgi alanı bazlı keşif
// gruplarında (Faz 16) kullanılır: fotoğraf + isim + hızlı beğen/geç, dokununca tam profil açılır.
class LikeActionCard extends StatelessWidget {
  const LikeActionCard({super.key, required this.profile, required this.onPass, required this.onLike});
  final PublicProfile profile;
  final VoidCallback onPass;
  final VoidCallback onLike;

  @override
  Widget build(BuildContext context) {
    final p = profile;
    return GestureDetector(
      onTap: () => context.push('/user/${p.id}'),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Brand.radius),
        child: Stack(fit: StackFit.expand, children: [
          NetPhoto(p.coverThumbUrl, width: 240, height: 240),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.center,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Colors.black87],
              ),
            ),
          ),
          if (p.superLikedMe) const Positioned(top: 8, left: 8, child: _SuperBadge()),
          Positioned(
            left: 10,
            right: 10,
            bottom: 10,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              NameWithBadge('${p.displayName}, ${p.age}',
                  verified: p.verified,
                  onPhoto: true,
                  badgeId: p.badgeId,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(child: MiniButton(icon: Icons.close_rounded, color: Brand.nope, onTap: onPass)),
                const SizedBox(width: 8),
                Expanded(child: MiniButton(icon: Icons.favorite_rounded, gradient: true, onTap: onLike)),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _SuperBadge extends StatelessWidget {
  const _SuperBadge();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: const ShapeDecoration(shape: StadiumBorder(), color: Color(0xFF2F80ED)),
        child: const Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.star_rounded, color: Colors.white, size: 14),
        ]),
      );
}

class MiniButton extends StatelessWidget {
  const MiniButton({super.key, required this.icon, required this.onTap, this.color, this.gradient = false});
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;
  final bool gradient;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: ShapeDecoration(
          shape: const StadiumBorder(),
          gradient: gradient ? Brand.gradient : null,
          color: gradient ? null : Colors.white,
        ),
        child: Material(
          type: MaterialType.transparency,
          shape: const StadiumBorder(),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: onTap,
            child: SizedBox(height: 34, child: Icon(icon, size: 20, color: gradient ? Colors.white : color)),
          ),
        ),
      );
}
