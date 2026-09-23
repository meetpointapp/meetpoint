import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import 'call_screen.dart';
import 'start_call.dart';

class CallHistoryScreen extends ConsumerWidget {
  const CallHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final calls = ref.watch(callHistoryProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.callHistory)),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(callHistoryProvider.future),
        child: calls.when(
          loading: () => const ListSkeleton(rows: 6),
          error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(callHistoryProvider)),
          data: (list) => list.isEmpty
              ? ListView(children: [
                  SizedBox(height: 420, child: CenteredMessage(icon: Icons.call_outlined, text: l.noCallsYet)),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const Divider(height: 1, indent: 76),
                  itemBuilder: (_, i) => _CallTile(list[i]),
                ),
        ),
      ),
    );
  }
}

class _CallTile extends ConsumerWidget {
  const _CallTile(this.call);
  final CallInfo call;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final missed = !call.outgoing && call.status == CallStatus.missed;
    final talked = call.answeredAt != null && call.status == CallStatus.ended;

    final (IconData dirIcon, Color dirColor) = switch (call) {
      _ when missed => (Icons.call_missed_rounded, theme.colorScheme.error),
      _ when call.outgoing => (Icons.call_made_rounded, const Color(0xFF1FA463)),
      _ => (Icons.call_received_rounded, const Color(0xFF2F80ED)),
    };
    final statusText = switch (call.status) {
      CallStatus.missed => call.outgoing ? l.callNoAnswer : l.callMissed,
      CallStatus.declined => l.callDeclined,
      CallStatus.cancelled => l.callCancelled,
      _ => callKindLabel(l, call.kind),
    };
    final when = _when(l, call.createdAt);
    final user = call.user;

    return ListTile(
      contentPadding: const EdgeInsets.fromLTRB(16, 4, 8, 4),
      leading: Avatar(user, radius: 24),
      onTap: user == null ? null : () => context.push('/user/${user.id}'),
      title: NameWithBadge(
        user?.displayName ?? '',
        verified: user?.verified ?? false,
        style: theme.textTheme.titleMedium?.copyWith(color: missed ? theme.colorScheme.error : null),
      ),
      subtitle: Row(children: [
        Icon(dirIcon, size: 15, color: dirColor),
        const SizedBox(width: 4),
        Flexible(child: Text('$statusText · $when', overflow: TextOverflow.ellipsis)),
      ]),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        if (talked)
          Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(formatCallTime(call.talkTime), style: theme.textTheme.labelMedium),
            const SizedBox(height: 2),
            CoinAmount(
              call.outgoing ? -call.totalCoins : call.totalCoins,
              signed: true,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: call.outgoing ? theme.colorScheme.onSurfaceVariant : const Color(0xFF1FA463),
              ),
            ),
          ]),
        if (user != null)
          IconButton(
            tooltip: l.callBack,
            color: Brand.coral,
            icon: Icon(callKindIcon(call.kind)),
            onPressed: () => startCallFlow(context, ref, user, call.kind),
          ),
      ]),
    );
  }

  String _when(AppLocalizations l, DateTime t) {
    final now = DateTime.now();
    final sameDay = t.year == now.year && t.month == now.month && t.day == now.day;
    return sameDay ? DateFormat.Hm(l.localeName).format(t) : DateFormat.MMMd(l.localeName).add_Hm().format(t);
  }
}
