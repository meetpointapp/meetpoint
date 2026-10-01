import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 19: kazananlar sıralaması. İsteğe bağlı katılım — sadece Profil ayarından açanlar görünür.
final _leaderboardProvider = FutureProvider.autoDispose.family<Leaderboard, String>(
  (ref, period) => ref.watch(apiProvider).leaderboard(period: period),
);

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen> {
  String _period = 'week';
  bool _busy = false;

  Future<void> _setOptIn(bool value) async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).setLeaderboardOptIn(value);
      ref.invalidate(_leaderboardProvider('week'));
      ref.invalidate(_leaderboardProvider('month'));
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final board = ref.watch(_leaderboardProvider(_period));

    return Scaffold(
      appBar: AppBar(title: Text(l.leaderboardTitle)),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: SegmentedButton<String>(
            showSelectedIcon: false,
            segments: [
              ButtonSegment(value: 'week', label: Text(l.leaderboardWeekly)),
              ButtonSegment(value: 'month', label: Text(l.leaderboardMonthly)),
            ],
            selected: {_period},
            onSelectionChanged: (s) => setState(() => _period = s.first),
          ),
        ),
        Expanded(
          child: board.when(
            loading: () => const ListSkeleton(rows: 6),
            error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_leaderboardProvider(_period))),
            data: (b) => RefreshIndicator(
              onRefresh: () => ref.refresh(_leaderboardProvider(_period).future),
              child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [
                _OptInCard(you: b.you, busy: _busy, onToggle: _setOptIn),
                const SizedBox(height: 16),
                if (b.entries.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: Text(l.leaderboardEmpty, style: theme.textTheme.bodyMedium, textAlign: TextAlign.center)),
                  )
                else
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: Column(children: [
                      for (final (i, e) in b.entries.indexed) ...[
                        if (i > 0) const Divider(height: 1, indent: 64, endIndent: 16),
                        _LeaderRow(entry: e),
                      ],
                    ]),
                  ),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

class _OptInCard extends StatelessWidget {
  const _OptInCard({required this.you, required this.busy, required this.onToggle});
  final YourRank? you;
  final bool busy;
  final ValueChanged<bool> onToggle;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final optedIn = you?.optedIn ?? false;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(Brand.radius), gradient: optedIn ? null : Brand.gradient, color: optedIn ? theme.colorScheme.surfaceContainerHighest : null),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(optedIn ? l.leaderboardOptedIn : l.leaderboardOptInBanner,
                style: theme.textTheme.titleSmall?.copyWith(color: optedIn ? null : Colors.white, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(
              optedIn && you != null ? '#${you!.rank} · ≈\$${you!.approxUsd}' : l.leaderboardOptInHint,
              style: theme.textTheme.bodySmall?.copyWith(color: optedIn ? theme.colorScheme.onSurfaceVariant : Colors.white.withValues(alpha: 0.9)),
            ),
          ]),
        ),
        const SizedBox(width: 12),
        if (busy)
          const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
        else
          Switch(
            value: optedIn,
            onChanged: onToggle,
            activeTrackColor: optedIn ? Brand.coral : null,
            thumbColor: optedIn ? null : const WidgetStatePropertyAll(Colors.white),
            trackColor: optedIn ? null : WidgetStatePropertyAll(Colors.white.withValues(alpha: 0.3)),
          ),
      ]),
    );
  }
}

const _medalColors = {1: Color(0xFFFFC94A), 2: Color(0xFFC0C0C0), 3: Color(0xFFCD7F32)};

class _LeaderRow extends StatelessWidget {
  const _LeaderRow({required this.entry});
  final LeaderboardEntry entry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final medal = _medalColors[entry.rank];
    return ListTile(
      leading: SizedBox(
        width: 44,
        child: Stack(alignment: Alignment.center, children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: theme.colorScheme.surfaceContainerHighest,
            backgroundImage: entry.photo != null ? NetworkImage(entry.photo!.thumbUrl) : null,
            child: entry.photo == null ? const Icon(Icons.person_outline_rounded, size: 20) : null,
          ),
          if (medal != null)
            Positioned(
              top: -4,
              right: -4,
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(shape: BoxShape.circle, color: medal, border: Border.all(color: theme.colorScheme.surface, width: 2)),
                child: Text('${entry.rank}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.black87)),
              ),
            ),
        ]),
      ),
      title: Text(entry.displayName, style: const TextStyle(fontWeight: FontWeight.w700)),
      trailing: Text('≈\$${entry.approxUsd}', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: const Color(0xFF1FA463))),
    );
  }
}
