import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import '../requests/requests_screen.dart';

// Faz 20: Sohbetler sekmesi iki bölümlü — "Sohbetler" (tüm konuşmalar) ve "İstekler" (gelen/giden
// mesaj istekleri). Eşleşmeler artık kendi sekmesinde (bkz. features/matches).
class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final convs = ref.watch(conversationsProvider);
    final pending = ref.watch(requestsProvider(true)).value?.where((r) => r.isPending).length ?? 0;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l.navChats),
          actions: [
            IconButton(
              tooltip: l.callHistory,
              icon: const Icon(Icons.history_rounded),
              onPressed: () => context.push('/calls'),
            ),
            const SizedBox(width: 4),
          ],
          bottom: TabBar(tabs: [
            Tab(text: l.navChats),
            Tab(
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(l.navRequests),
                if (pending > 0) ...[
                  const SizedBox(width: 6),
                  Badge(label: Text('$pending'), backgroundColor: Brand.coral),
                ],
              ]),
            ),
          ]),
        ),
        body: TabBarView(children: [
          RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(likesProvider);
              ref.invalidate(conversationsProvider);
              await ref.read(conversationsProvider.future);
            },
            // Konuşma sayısı büyüyebilir: liste ekranda görünen kadarını oluşturur (lazy builder)
            child: CustomScrollView(physics: const AlwaysScrollableScrollPhysics(), slivers: [
              ...convs.when(
                loading: () => [const SliverToBoxAdapter(child: SizedBox(height: 400, child: ListSkeleton(rows: 5)))],
                error: (e, _) => [
                  SliverToBoxAdapter(
                    child: SizedBox(height: 400, child: ErrorRetry(error: e, onRetry: () => ref.invalidate(conversationsProvider))),
                  ),
                ],
                data: (list) => list.isEmpty
                    ? [SliverToBoxAdapter(child: SizedBox(height: 360, child: CenteredMessage(icon: Icons.forum_outlined, text: l.noChats)))]
                    : [SliverList.builder(itemCount: list.length, itemBuilder: (_, i) => _ConversationTile(list[i]))],
              ),
            ]),
          ),
          const RequestsBody(),
        ]),
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile(this.c);
  final Conversation c;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final last = c.lastMessage;
    final unread = c.unreadCount > 0;
    final preview = last == null
        ? (c.origin == 'MATCH' ? l.matchedChat : l.requestChat)
        : last.isPhoto
            ? '📷 ${l.photo}'
            : last.body;

    return ListTile(
      leading: Avatar(c.user, radius: 26),
      title: NameWithBadge(
        c.user?.displayName ?? '—',
        verified: c.user?.verified ?? false,
        premium: c.user?.premium ?? false,
        style: theme.textTheme.titleMedium?.copyWith(fontWeight: unread ? FontWeight.w800 : FontWeight.w600),
      ),
      subtitle: Text(
        preview,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: unread ? TextStyle(color: theme.colorScheme.onSurface, fontWeight: FontWeight.w600) : null,
      ),
      trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
        if (last != null)
          Text(_timeLabel(last.createdAt, l.localeName),
              style: theme.textTheme.bodySmall?.copyWith(color: unread ? Brand.coral : null)),
        if (unread) ...[
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
            decoration: ShapeDecoration(shape: StadiumBorder(), gradient: Brand.gradient),
            child: Text('${c.unreadCount}', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
          ),
        ],
      ]),
      onTap: () => context.push('/chat/${c.id}'),
    );
  }
}

String _timeLabel(DateTime t, String locale) {
  final now = DateTime.now();
  final sameDay = t.year == now.year && t.month == now.month && t.day == now.day;
  return sameDay ? DateFormat.Hm(locale).format(t) : DateFormat.MMMd(locale).format(t);
}
