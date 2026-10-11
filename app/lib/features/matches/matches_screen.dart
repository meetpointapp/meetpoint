import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 20: "Eşleşmeler" kendi sekmesi. Karşılıklı beğeniyle açılan tüm sohbetler büyük fotoğraf
// kartlarında; henüz mesajlaşılmamış (yeni) eşleşmeler önde ve "Yeni" etiketli. İstek yoluyla açılan
// sohbetler (mesaj isteği) burada değil, Sohbetler sekmesinde durur.
class MatchesScreen extends ConsumerWidget {
  const MatchesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final convs = ref.watch(conversationsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l.matchesTitle)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(likesProvider);
          ref.invalidate(conversationsProvider);
          await ref.read(conversationsProvider.future);
        },
        child: CustomScrollView(physics: const AlwaysScrollableScrollPhysics(), slivers: [
          const SliverToBoxAdapter(child: _LikesYouTile()),
          ...convs.when(
            loading: () => [const SliverToBoxAdapter(child: SizedBox(height: 400, child: ListSkeleton(rows: 4)))],
            error: (e, _) => [
              SliverToBoxAdapter(
                child: SizedBox(height: 400, child: ErrorRetry(error: e, onRetry: () => ref.invalidate(conversationsProvider))),
              ),
            ],
            data: (list) {
              final matches = sortedMatches(list);
              if (matches.isEmpty) {
                return [
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: 420,
                      child: CenteredMessage(
                        icon: Icons.favorite_border_rounded,
                        text: l.matchesEmpty,
                        action: FilledButton.tonal(onPressed: () => context.go('/discover'), child: Text(l.matchesDiscoverCta)),
                      ),
                    ),
                  ),
                ];
              }
              return [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                  sliver: SliverGrid.builder(
                    gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                      maxCrossAxisExtent: 220,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.78,
                    ),
                    itemCount: matches.length,
                    itemBuilder: (_, i) => _MatchCard(matches[i]),
                  ),
                ),
              ];
            },
          ),
        ]),
      ),
    );
  }
}

// Sadece karşılıklı beğeniyle açılanlar; yeni (mesajsız) olanlar önde, sonra en yeniden eskiye
List<Conversation> sortedMatches(List<Conversation> all) {
  final matches = all.where((c) => c.origin == 'MATCH').toList();
  matches.sort((a, b) {
    final an = a.lastMessage == null ? 0 : 1;
    final bn = b.lastMessage == null ? 0 : 1;
    return an != bn ? an - bn : b.createdAt.compareTo(a.createdAt);
  });
  return matches;
}

// Alt menü rozeti için: mesajlaşılmamış yeni eşleşme sayısı
int newMatchCount(List<Conversation> all) => all.where((c) => c.origin == 'MATCH' && c.lastMessage == null).length;

class _MatchCard extends StatelessWidget {
  const _MatchCard(this.c);
  final Conversation c;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final user = c.user;
    final isNew = c.lastMessage == null;
    return Semantics(
      button: true,
      label: user?.displayName ?? '',
      excludeSemantics: true,
      onTap: () => context.push('/chat/${c.id}'),
      child: GestureDetector(
        onTap: () => context.push('/chat/${c.id}'),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: isNew ? Border.all(color: Brand.coral, width: 2.5) : null,
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 12, offset: const Offset(0, 5))],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(isNew ? 17 : 20),
            child: Stack(fit: StackFit.expand, children: [
              NetPhoto(user?.coverUrl, width: 220, height: 280),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(begin: Alignment(0, 0.2), end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black87]),
                ),
              ),
              if (isNew)
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                    decoration: ShapeDecoration(shape: StadiumBorder(), gradient: Brand.gradient),
                    child: Text(l.matchesNew, style: TextStyle(color: Brand.onAccent, fontWeight: FontWeight.w800, fontSize: 11)),
                  ),
                ),
              if (c.unreadCount > 0)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: const ShapeDecoration(shape: StadiumBorder(), color: Colors.white),
                    child: Text('${c.unreadCount}', style: TextStyle(color: Brand.coral, fontWeight: FontWeight.w800, fontSize: 12)),
                  ),
                ),
              Positioned(
                left: 12,
                right: 12,
                bottom: 12,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  NameWithBadge(
                    user == null ? '—' : '${user.displayName}, ${user.age}',
                    verified: user?.verified ?? false,
                    premium: user?.premium ?? false,
                    onPhoto: true,
                    style: theme.textTheme.titleMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isNew ? l.matchedChat : (c.lastMessage!.isPhoto ? '📷 ${l.photo}' : c.lastMessage!.body),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12),
                  ),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

// Eşleşmelerin üstünde "Seni beğenenler" girişi
class _LikesYouTile extends ConsumerWidget {
  const _LikesYouTile();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final likes = ref.watch(likesProvider).value;
    if (likes == null || likes.count == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Material(
        borderRadius: BorderRadius.circular(Brand.radius),
        clipBehavior: Clip.antiAlias,
        child: Ink(
          decoration: BoxDecoration(gradient: Brand.gradient),
          child: InkWell(
            onTap: () => context.push('/likes'),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: Brand.onAccent.withValues(alpha: 0.2)),
                  child: Icon(likes.unlocked ? Icons.favorite_rounded : Icons.lock_rounded, color: Brand.onAccent),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(l.likesYou, style: TextStyle(color: Brand.onAccent, fontWeight: FontWeight.w800, fontSize: 16)),
                    Text(l.likesYouCount(likes.count), style: TextStyle(color: Brand.onAccent.withValues(alpha: 0.9))),
                  ]),
                ),
                Icon(Icons.chevron_right_rounded, color: Brand.onAccent),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
