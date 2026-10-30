import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/models.dart';
import '../../core/profile_completion.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';

// Faz 24: eksik profilleri tamamlamaya yönlendirme. Keşfetin üstünde ince bir bant; kapatılırsa 24 saat
// görünmez. Dokununca neyin eksik olduğunu (ve her birinin %10 getirdiğini) gösteren liste açılır.
const _dismissKey = 'profile_nudge_until';

class ProfileNudgeBanner extends ConsumerStatefulWidget {
  const ProfileNudgeBanner({super.key});

  @override
  ConsumerState<ProfileNudgeBanner> createState() => _ProfileNudgeBannerState();
}

class _ProfileNudgeBannerState extends ConsumerState<ProfileNudgeBanner> {
  bool _hidden = true; // tercih okunana kadar gizli (parlama olmasın)

  @override
  void initState() {
    super.initState();
    _read();
  }

  Future<void> _read() async {
    try {
      final until = (await SharedPreferences.getInstance()).getInt(_dismissKey) ?? 0;
      if (mounted) setState(() => _hidden = DateTime.now().millisecondsSinceEpoch < until);
    } catch (_) {
      if (mounted) setState(() => _hidden = false);
    }
  }

  Future<void> _dismiss() async {
    setState(() => _hidden = true);
    try {
      final until = DateTime.now().add(const Duration(hours: 24)).millisecondsSinceEpoch;
      await (await SharedPreferences.getInstance()).setInt(_dismissKey, until);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(meProvider).value?.profile;
    if (_hidden || profile == null) return const SizedBox.shrink();
    final percent = profileCompletion(profile);
    if (percent >= 100) return const SizedBox.shrink();
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Material(
        color: Brand.coral.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => showProfileChecklist(context, profile),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
            child: Row(children: [
              SizedBox(
                width: 40,
                height: 40,
                child: Stack(alignment: Alignment.center, children: [
                  CircularProgressIndicator(value: percent / 100, strokeWidth: 4, color: Brand.coral, backgroundColor: Brand.coral.withValues(alpha: 0.2)),
                  Text('$percent', style: theme.textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w900)),
                ]),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(l.profileNudgeTitle(percent), style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  Text(l.profileNudgeBody, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant, height: 1.25)),
                ]),
              ),
              TextButton(onPressed: () => showProfileChecklist(context, profile), child: Text(l.profileNudgeCta)),
              IconButton(onPressed: _dismiss, icon: const Icon(Icons.close_rounded, size: 18), visualDensity: VisualDensity.compact),
            ]),
          ),
        ),
      ),
    );
  }
}

String _stepLabel(AppLocalizations l, MissingStep s, int n) => switch (s) {
      MissingStep.photos => l.profileMissPhotos(n),
      MissingStep.interests => l.profileMissInterests,
      MissingStep.lookingFor => l.profileMissLookingFor,
      MissingStep.prompts => l.profileMissPrompts(n),
      MissingStep.bio => l.profileMissBio,
      MissingStep.basics => l.profileMissBasics,
    };

IconData _stepIcon(MissingStep s) => switch (s) {
      MissingStep.photos => Icons.add_a_photo_outlined,
      MissingStep.interests => Icons.interests_outlined,
      MissingStep.lookingFor => Icons.favorite_border_rounded,
      MissingStep.prompts => Icons.question_answer_outlined,
      MissingStep.bio => Icons.edit_note_rounded,
      MissingStep.basics => Icons.badge_outlined,
    };

Future<void> showProfileChecklist(BuildContext context, PublicProfile profile) {
  final l = AppLocalizations.of(context);
  final theme = Theme.of(context);
  final percent = profileCompletion(profile);
  final missing = profileMissing(profile);
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(l.profileChecklistTitle, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text(l.profileNudgeBody, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(value: percent / 100, minHeight: 8, color: Brand.coral, backgroundColor: Brand.coral.withValues(alpha: 0.18)),
          ),
          const SizedBox(height: 14),
          for (final (step, n) in missing)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(shape: BoxShape.circle, color: Brand.coral.withValues(alpha: 0.12)),
                child: Icon(_stepIcon(step), color: Brand.coral, size: 20),
              ),
              title: Text(_stepLabel(l, step, n), style: const TextStyle(fontWeight: FontWeight.w700)),
              trailing: Text('+%${step == MissingStep.photos || step == MissingStep.prompts ? n * 10 : 10}',
                  style: TextStyle(color: Brand.coral, fontWeight: FontWeight.w900)),
              onTap: () {
                Navigator.pop(ctx);
                context.push('/me/edit');
              },
            ),
          const SizedBox(height: 10),
          GradientButton(
            label: l.profileChecklistCta,
            icon: Icons.edit_rounded,
            onPressed: () {
              Navigator.pop(ctx);
              context.push('/me/edit');
            },
          ),
        ]),
      ),
    ),
  );
}
