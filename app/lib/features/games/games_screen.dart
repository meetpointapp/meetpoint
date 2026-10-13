import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 23: oyunlarım — sıra bende olanlar önde
class GamesScreen extends ConsumerWidget {
  const GamesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final games = ref.watch(truthDareGamesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.gamesTitle)),
      body: games.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(truthDareGamesProvider)),
        data: (r) {
          if (r.games.isEmpty) return CenteredMessage(icon: Icons.casino_outlined, text: l.gamesEmpty);
          final sorted = [...r.games]..sort((a, b) {
              int rank(TruthDareGame g) => g.active && g.myTurn ? 0 : (g.active ? 1 : 2);
              final c = rank(a).compareTo(rank(b));
              return c != 0 ? c : b.updatedAt.compareTo(a.updatedAt);
            });
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(truthDareGamesProvider);
              await ref.read(truthDareGamesProvider.future);
            },
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: sorted.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final g = sorted[i];
                final turn = g.active && g.myTurn;
                final label = g.finished ? l.tdFinishedShort : (turn ? l.tdYourTurn : l.tdWaitingShort);
                return Card(
                  margin: EdgeInsets.zero,
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    leading: Avatar(g.other, radius: 24),
                    title: NameWithBadge(g.other.displayName, verified: g.other.verified, premium: g.other.premium, badgeId: g.other.badgeId),
                    subtitle: Text(l.tdRoundOf(g.finished ? g.totalRounds : g.round, g.totalRounds)),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: ShapeDecoration(
                        shape: const StadiumBorder(),
                        gradient: turn ? Brand.gradient : null,
                        color: turn ? null : theme.colorScheme.surfaceContainerHighest,
                      ),
                      child: Text(label, style: TextStyle(color: turn ? Brand.onAccent : theme.colorScheme.onSurfaceVariant, fontWeight: FontWeight.w800, fontSize: 12)),
                    ),
                    onTap: () async {
                      await context.push('/game/${g.id}');
                      ref.invalidate(truthDareGamesProvider);
                    },
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
