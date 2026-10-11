import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/fx.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 20: günlük giriş ödülü. Her gün bir kez alınır; ödül 7 günlük döngüde artar, seri eşiklerinde
// küçük bir bonus eklenir. Jetonlar harcanabilir ama bozdurulamaz. Takvim, o ay alınan günleri gösterir.
final dailyRewardProvider = FutureProvider.autoDispose.family<DailyReward, String?>(
  (ref, month) => ref.watch(apiProvider).dailyReward(month: month),
);

class DailyRewardScreen extends ConsumerStatefulWidget {
  const DailyRewardScreen({super.key});

  @override
  ConsumerState<DailyRewardScreen> createState() => _DailyRewardScreenState();
}

class _DailyRewardScreenState extends ConsumerState<DailyRewardScreen> {
  String? _month; // null = bu ay
  bool _busy = false;

  Future<void> _claim() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      final r = await ref.read(apiProvider).claimDailyReward();
      ref.invalidate(walletProvider);
      ref.invalidate(dailyRewardProvider);
      ref.invalidate(dailyClaimableProvider);
      Fx.celebrate();
      if (mounted) {
        showSnack(context, r.claimedBonus > 0 ? '${l.dailyClaimedSnack(r.claimedCoins)} · ${l.dailyBonusLine(r.claimedCoins)}' : l.dailyClaimedSnack(r.claimedCoins));
      }
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // YYYY-MM üzerinde ay gezintisi
  String _shift(String ym, int delta) {
    final y = int.parse(ym.substring(0, 4));
    final m = int.parse(ym.substring(5, 7));
    final d = DateTime(y, m + delta, 1);
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final state = ref.watch(dailyRewardProvider(_month));

    return Scaffold(
      appBar: AppBar(title: Text(l.dailyTitle)),
      body: state.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(dailyRewardProvider)),
        data: (r) => ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
          // Seri + ödül alma
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              gradient: Brand.gradient,
              boxShadow: [BoxShadow(color: Brand.coral.withValues(alpha: 0.28), blurRadius: 18, offset: const Offset(0, 8))],
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: Brand.onAccent.withValues(alpha: 0.18)),
                  child: Icon(Icons.local_fire_department_rounded, color: Brand.onAccent, size: 30),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(l.dailyStreak(r.streak), style: TextStyle(color: Brand.onAccent, fontWeight: FontWeight.w900, fontSize: 20)),
                    if (r.nextBonusStreak != null)
                      Text(l.dailyNextBonus(r.nextBonusStreak!, r.nextBonusCoins),
                          style: TextStyle(color: Brand.onAccent.withValues(alpha: 0.9), fontSize: 12.5)),
                  ]),
                ),
              ]),
              const SizedBox(height: 14),
              if (r.claimable)
                Material(
                  color: Brand.onAccent,
                  borderRadius: BorderRadius.circular(30),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(30),
                    onTap: _busy ? null : _claim,
                    child: SizedBox(
                      height: 48,
                      child: Center(
                        child: _busy
                            ? SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Brand.coral))
                            : Text(l.dailyClaim(r.todayCoins), style: TextStyle(color: Brand.coral, fontWeight: FontWeight.w900, fontSize: 15)),
                      ),
                    ),
                  ),
                )
              else
                Container(
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(30), color: Colors.white.withValues(alpha: 0.2)),
                  child: Text(r.claimedToday ? l.dailyClaimedToday : l.dailyComeBack,
                      style: TextStyle(color: Brand.onAccent, fontWeight: FontWeight.w800)),
                ),
              if (r.claimedToday)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(l.dailyComeBack, textAlign: TextAlign.center, style: TextStyle(color: Brand.onAccent.withValues(alpha: 0.9), fontSize: 12.5)),
                ),
            ]),
          ),
          const SizedBox(height: 14),
          // 7 günlük döngü
          Row(children: [
            for (final d in r.cycle) ...[
              Expanded(child: _CycleTile(day: d, done: d.day < r.cycleDay || (d.day == r.cycleDay && r.claimedToday), current: d.day == r.cycleDay && !r.claimedToday)),
              if (d.day != r.cycle.last.day) const SizedBox(width: 6),
            ],
          ]),
          const SizedBox(height: 18),
          // Takvim
          Row(children: [
            IconButton(
              visualDensity: VisualDensity.compact,
              onPressed: () => setState(() => _month = _shift(r.month, -1)),
              icon: const Icon(Icons.chevron_left_rounded),
            ),
            Expanded(
              child: Text(
                DateFormat.yMMMM(l.localeName).format(DateTime(int.parse(r.month.substring(0, 4)), int.parse(r.month.substring(5, 7)))),
                textAlign: TextAlign.center,
                style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
            IconButton(
              visualDensity: VisualDensity.compact,
              onPressed: r.month.compareTo(r.today.substring(0, 7)) >= 0 ? null : () => setState(() => _month = _shift(r.month, 1)),
              icon: const Icon(Icons.chevron_right_rounded),
            ),
          ]),
          _Calendar(reward: r),
          const SizedBox(height: 10),
          Center(child: Text(l.dailyMonthTotal(r.monthCoins), style: theme.textTheme.labelLarge?.copyWith(color: Brand.coral, fontWeight: FontWeight.w800))),
          const SizedBox(height: 14),
          Text(l.dailyInfo, textAlign: TextAlign.center, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        ]),
      ),
    );
  }
}

class _CycleTile extends StatelessWidget {
  const _CycleTile({required this.day, required this.done, required this.current});
  final DailyCycleDay day;
  final bool done;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l = AppLocalizations.of(context);
    return Semantics(
      label: '${l.dailyDay(day.day)}: ${day.coins}',
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: done ? Brand.coral.withValues(alpha: 0.14) : theme.cardTheme.color,
          border: Border.all(color: current ? Brand.coral : theme.colorScheme.outlineVariant.withValues(alpha: 0.6), width: current ? 2 : 1),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('${day.day}', style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Icon(done ? Icons.check_circle_rounded : Icons.toll_rounded, size: 20, color: done ? Brand.coral : Brand.gold),
          const SizedBox(height: 4),
          Text('+${day.coins}', style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w900)),
        ]),
      ),
    );
  }
}

class _Calendar extends StatelessWidget {
  const _Calendar({required this.reward});
  final DailyReward reward;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final year = int.parse(reward.month.substring(0, 4));
    final month = int.parse(reward.month.substring(5, 7));
    final first = DateTime(year, month, 1);
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final leading = first.weekday - 1; // pazartesi = 0
    final isThisMonth = reward.month == reward.today.substring(0, 7);
    final todayNum = isThisMonth ? int.parse(reward.today.substring(8, 10)) : -1;
    final cells = leading + daysInMonth;
    final rows = (cells / 7).ceil();
    // Başlık günleri: bilinen bir pazartesiden itibaren yerel kısa adlar
    final monday = DateTime(2024, 1, 1);
    final weekdays = [for (var i = 0; i < 7; i++) DateFormat.E(l.localeName).format(monday.add(Duration(days: i)))];

    return Column(children: [
      Row(children: [
        for (final w in weekdays)
          Expanded(
            child: Center(
              child: Text(w, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant, fontWeight: FontWeight.w700)),
            ),
          ),
      ]),
      const SizedBox(height: 6),
      for (var r = 0; r < rows; r++)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(children: [
            for (var c = 0; c < 7; c++)
              Expanded(
                child: () {
                  final n = r * 7 + c - leading + 1;
                  if (n < 1 || n > daysInMonth) return const SizedBox(height: 38);
                  final claimed = reward.claimedDays.contains(n);
                  final isToday = n == todayNum;
                  final future = isThisMonth && n > todayNum;
                  return Center(
                    child: Container(
                      width: 38,
                      height: 38,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: claimed ? Brand.gradient : null,
                        border: isToday && !claimed ? Border.all(color: Brand.coral, width: 2) : null,
                      ),
                      child: claimed
                          ? Icon(Icons.check_rounded, size: 20, color: Brand.onAccent)
                          : Text(
                              '$n',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                fontWeight: isToday ? FontWeight.w900 : FontWeight.w500,
                                color: future ? theme.colorScheme.onSurface.withValues(alpha: 0.35) : theme.colorScheme.onSurface,
                              ),
                            ),
                    ),
                  );
                }(),
              ),
          ]),
        ),
    ]);
  }
}
