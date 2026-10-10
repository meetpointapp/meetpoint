import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Bağımsız sayfa: bildirim/banner bağlantıları için (/requests). Normal kullanım Sohbetler sekmesinin içinde.
class RequestsScreen extends StatelessWidget {
  const RequestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.navRequests)),
      body: const RequestsBody(),
    );
  }
}

// Gelen / giden istekler. Sohbetler sekmesinin "İstekler" bölümü olarak da kullanılır.
class RequestsBody extends StatefulWidget {
  const RequestsBody({super.key});

  @override
  State<RequestsBody> createState() => _RequestsBodyState();
}

class _RequestsBodyState extends State<RequestsBody> {
  bool _inbox = true;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
        child: SizedBox(
          width: double.infinity,
          child: SegmentedButton<bool>(
            showSelectedIcon: false,
            segments: [
              ButtonSegment(value: true, label: Text(l.inbox), icon: const Icon(Icons.move_to_inbox_outlined, size: 18)),
              ButtonSegment(value: false, label: Text(l.outbox), icon: const Icon(Icons.outbox_outlined, size: 18)),
            ],
            selected: {_inbox},
            onSelectionChanged: (v) => setState(() => _inbox = v.first),
          ),
        ),
      ),
      Expanded(child: _RequestList(key: ValueKey(_inbox), inbox: _inbox)),
    ]);
  }
}

class _RequestList extends ConsumerWidget {
  const _RequestList({super.key, required this.inbox});
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
              widget.inbox ? '${l.requestEarnRule(r.price, r.escrowReplies, r.escrowMinWords)} · ${l.expiresIn(hoursLeft)}' : l.expiresIn(hoursLeft),
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
          ] else ...[
            Chip(label: Text(_statusLabel(l, r.status)), visualDensity: VisualDensity.compact),
            // Faz 20: emanet — jetonun kime ne zaman geçeceği
            if (r.escrow) ...[
              const SizedBox(height: 6),
              Text(
                widget.inbox
                    ? l.requestEscrowEarner(r.price, r.escrowMinWords, r.escrowNeeded)
                    : l.requestEscrowPayer(r.escrowReplies - r.escrowNeeded, r.escrowReplies),
                style: theme.textTheme.bodySmall?.copyWith(color: Brand.coral, fontWeight: FontWeight.w600),
              ),
            ] else if (r.settlement == 'RELEASED' && widget.inbox)
              Padding(padding: const EdgeInsets.only(top: 6), child: Text(l.requestReleased, style: theme.textTheme.bodySmall?.copyWith(color: Brand.like, fontWeight: FontWeight.w600)))
            else if (r.settlement == 'REFUNDED')
              Padding(padding: const EdgeInsets.only(top: 6), child: Text(l.requestRefunded, style: theme.textTheme.bodySmall)),
          ],
        ]),
      ),
    );
  }
}
