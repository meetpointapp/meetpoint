import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/catalog.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import '../profile/vibe_screen.dart';

// Faz 17 madde 3: "Gelişimim" ekranı. Vibe kartını, üç izdeki kademeleri, açılan oda/avatar
// ödüllerini ve bağlam duyarlı bir "sıradaki adım" önerisini tek ekranda toplar — dağınık bir
// rozet listesi değil, gerçek bir yolculuk hissi veren bütünlüklü bir tasarım.
final _journeyHintProvider = FutureProvider.autoDispose<NextStepHint?>(
  (ref) => ref.watch(apiProvider).journeyNextStep(),
);

const _tierColors = [
  Color(0xFFCD7F32),
  Color(0xFFC0C0C0),
  Color(0xFFFFD700),
]; // bronz, gümüş, altın

class JourneyScreen extends ConsumerWidget {
  const JourneyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final me = ref.watch(meProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.journeyTitle)),
      body: me.when(
        loading: () => const ListSkeleton(rows: 5),
        error: (e, _) =>
            ErrorRetry(error: e, onRetry: () => ref.invalidate(meProvider)),
        data: (m) => _Body(me: m),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.me});
  final Me me;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final archetypeId = me.profile?.vibeArchetypeId ?? '';
    final hint = ref.watch(_journeyHintProvider);
    final unlocked = [
      for (final t in AchievementTrack.values)
        for (final ms in me.achievements.of(t).milestones)
          if (ms.done) ms.id,
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (archetypeId.isNotEmpty)
          VibeCard(archetypeId: archetypeId)
        else
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Brand.radius),
              color: theme.colorScheme.surfaceContainerHighest,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(l.vibeIntro, style: theme.textTheme.bodySmall),
                ),
                const SizedBox(width: 12),
                OutlinedButton(
                  onPressed: () async {
                    await context.push<String>('/vibe');
                    ref.invalidate(meProvider);
                  },
                  child: Text(l.vibeStart),
                ),
              ],
            ),
          ),
        const SizedBox(height: 20),

        hint.when(
          loading: () => const SizedBox.shrink(),
          error: (_, _) => const SizedBox.shrink(),
          data: (h) => h == null
              ? const SizedBox.shrink()
              : Padding(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(Brand.radius),
                      onTap: () => context.push('/chat/${h.conversationId}'),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(Brand.radius),
                          gradient: Brand.gradient,
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.lightbulb_rounded,
                              color: Colors.white,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    l.journeyNextStepTitle,
                                    style: theme.textTheme.labelLarge?.copyWith(
                                      color: Colors.white70,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    l.journeyNextStepBody(
                                      l.interestLabel(h.interestId),
                                    ),
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(
                              Icons.chevron_right_rounded,
                              color: Colors.white,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
        ),

        for (final t in AchievementTrack.values) ...[
          _TrackSection(track: t, state: me.achievements.of(t)),
          const SizedBox(height: 16),
        ],

        Text(l.journeyRewardsTitle, style: theme.textTheme.titleSmall),
        const SizedBox(height: 10),
        if (unlocked.isEmpty)
          Text(
            l.journeyRewardsEmpty,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          )
        else
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final id in unlocked)
                Tooltip(
                  message: l.milestoneLabel(id),
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: milestoneRewardColorOf(id),
                    ),
                    child: milestoneRewardEmojiOf(id).isEmpty
                        ? null
                        : Center(
                            child: Text(
                              milestoneRewardEmojiOf(id),
                              style: const TextStyle(fontSize: 18),
                            ),
                          ),
                  ),
                ),
            ],
          ),
      ],
    );
  }
}

class _TrackSection extends StatelessWidget {
  const _TrackSection({required this.track, required this.state});
  final AchievementTrack track;
  final TrackState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final title = switch (track) {
      AchievementTrack.iletisim => l.trackIletisim,
      AchievementTrack.baglanti => l.trackBaglanti,
      AchievementTrack.kimlik => l.trackKimlik,
      AchievementTrack.kazanc => l.trackKazanc,
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            for (final (i, ms) in state.milestones.indexed) ...[
              if (i > 0) const SizedBox(height: 10),
              Row(
                children: [
                  Icon(
                    ms.done
                        ? Icons.check_circle_rounded
                        : Icons.circle_outlined,
                    size: 20,
                    color: ms.done ? _tierColors[i] : theme.colorScheme.outline,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      l.milestoneLabel(ms.id),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: ms.done
                            ? null
                            : theme.colorScheme.onSurfaceVariant,
                        decoration: ms.done ? null : TextDecoration.none,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
