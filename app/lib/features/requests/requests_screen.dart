import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

class RequestsScreen extends StatelessWidget {
  const RequestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l.navRequests),
          bottom: TabBar(tabs: [Tab(text: l.inbox), Tab(text: l.outbox)]),
        ),
        body: const TabBarView(children: [_RequestList(inbox: true), _RequestList(inbox: false)]),
      ),
    );
  }
}

class _RequestList extends ConsumerWidget {
  const _RequestList({required this.inbox});
  final bool inbox;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final requests = ref.watch(requestsProvider(inbox));
    return requests.when(
      loading: () => const ListSkeleton(),
      error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(requestsProvider(inbox))),
      data: (list) => RefreshIndicator(
        onRefresh: () => ref.refresh(requestsProvider(inbox).future),
        child: list.isEmpty
            ? ListView(children: [
                SizedBox(height: 400, child: CenteredMessage(icon: Icons.mail_outline_rounded, text: l.noRequests)),
              ])
            : ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _RequestCard(request: list[i], inbox: inbox),
              ),
      ),
    );
  }
}

class _RequestCard extends ConsumerStatefulWidget {
  const _RequestCard({required this.request, required this.inbox});
  final ContactRequest request;
  final bool inbox;

  @override
  ConsumerState<_RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends ConsumerState<_RequestCard> {
  bool _busy = false;

  Future<void> _act(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
    } catch (e) {
      if (mounted) showSnack(context, errorText(AppLocalizations.of(context), e));
    } finally {
      ref.invalidate(requestsProvider(widget.inbox));
      ref.invalidate(walletProvider);
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _accept() => _act(() async {
        final l = AppLocalizations.of(context);
        final conversationId = await ref.read(apiProvider).acceptRequest(widget.request.id);
        ref.invalidate(conversationsProvider);
        if (!mounted) return;
        if (conversationId != null) {
          context.push('/chat/$conversationId');
        } else {
          showSnack(context, l.callComingSoon);
        }
      });

  String _statusLabel(AppLocalizations l, String status) => switch (status) {
        'PENDING' => l.statusPending,
        'ACCEPTED' => l.statusAccepted,
        'REJECTED' => l.statusRejected,
        'CANCELLED' => l.statusCancelled,
        _ => l.statusExpired,
      };

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final r = widget.request;
    final user = r.user;
    final hoursLeft = r.expiresAt.difference(DateTime.now()).inHours.clamp(0, 999);

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            GestureDetector(
              onTap: user == null ? null : () => context.push('/user/${user.id}'),
              child: Avatar(user, radius: 26),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                NameWithBadge(user == null ? '—' : '${user.displayName}, ${user.age}',
                    verified: user?.verified ?? false, style: theme.textTheme.titleMedium),
                Row(children: [
                  Icon(requestKindIcon(r.kind), size: 16, color: theme.colorScheme.primary),
                  const SizedBox(width: 4),
                  Text(requestKindLabel(l, r.kind), style: theme.textTheme.bodySmall),
                ]),
              ]),
            ),
            CoinAmount(r.price, signed: widget.inbox, style: const TextStyle(fontWeight: FontWeight.w700)),
          ]),
          if (r.note.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(r.note),
            ),
          ],
          const SizedBox(height: 10),
          if (r.isPending) ...[
            Text(
              widget.inbox ? '${l.earnOnAccept(r.price)} · ${l.expiresIn(hoursLeft)}' : l.expiresIn(hoursLeft),
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            if (widget.inbox)
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _act(() => ref.read(apiProvider).rejectRequest(r.id)),
                    child: Text(l.reject),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(child: FilledButton(onPressed: _busy ? null : _accept, child: Text(l.accept))),
              ])
            else
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _busy ? null : () => _act(() => ref.read(apiProvider).cancelRequest(r.id)),
                  child: Text(l.cancelRequest),
                ),
              ),
          ] else
            Chip(label: Text(_statusLabel(l, r.status)), visualDensity: VisualDensity.compact),
        ]),
      ),
    );
  }
}
