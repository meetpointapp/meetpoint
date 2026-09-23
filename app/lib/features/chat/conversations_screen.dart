import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final convs = ref.watch(conversationsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l.navChats), actions: [
        IconButton(
          tooltip: l.callHistory,
          icon: const Icon(Icons.history_rounded),
          onPressed: () => context.push('/calls'),
        ),
        const SizedBox(width: 4),
      ]),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(likesProvider);
          ref.invalidate(conversationsProvider);
          await ref.read(conversationsProvider.future);
        },
        child: ListView(children: [
          const _LikesYouTile(),
          ...convs.when(
            loading: () => [const SizedBox(height: 400, child: ListSkeleton(rows: 5))],
            error: (e, _) => [
              SizedBox(height: 400, child: ErrorRetry(error: e, onRetry: () => ref.invalidate(conversationsProvider))),
            ],
            data: (list) => list.isEmpty
                ? [SizedBox(height: 360, child: CenteredMessage(icon: Icons.forum_outlined, text: l.noChats))]
                : [for (final c in list) _ConversationTile(c)],
          ),
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
            decoration: const ShapeDecoration(shape: StadiumBorder(), gradient: Brand.gradient),
            child: Text('${c.unreadCount}', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
          ),
        ],
      ]),
      onTap: () => context.push('/chat/${c.id}'),
    );
  }
}

// Listenin üstünde "Seni beğenenler" girişi
class _LikesYouTile extends ConsumerWidget {
  const _LikesYouTile();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final likes = ref.watch(likesProvider).value;
    if (likes == null || likes.count == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: Material(
        borderRadius: BorderRadius.circular(Brand.radius),
        clipBehavior: Clip.antiAlias,
        child: Ink(
          decoration: const BoxDecoration(gradient: Brand.gradient),
          child: InkWell(
            onTap: () => context.push('/likes'),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.25)),
                  child: Icon(likes.unlocked ? Icons.favorite_rounded : Icons.lock_rounded, color: Colors.white),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(l.likesYou, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                    Text(l.likesYouCount(likes.count), style: TextStyle(color: Colors.white.withValues(alpha: 0.9))),
                  ]),
                ),
                const Icon(Icons.chevron_right_rounded, color: Colors.white),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

String _timeLabel(DateTime t, String locale) {
  final now = DateTime.now();
  final sameDay = t.year == now.year && t.month == now.month && t.day == now.day;
  return sameDay ? DateFormat.Hm(locale).format(t) : DateFormat.MMMd(locale).format(t);
}
