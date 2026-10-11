import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/fx.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import 'compose_post_sheet.dart';
import 'social_widgets.dart';
import 'stories.dart';

// Faz 22: akış. Sadece yazı tabanlı gönderiler; herkes okur, beğenir ve takip eder; gönderi, yorum ve
// hikaye mavi tikli hesaplara açık. Üstte hikaye halkaları, altında sekmeli akış.
class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});

  @override
  ConsumerState<FeedScreen> createState() => _FeedScreenState();
}

class _Pager {
  List<Post> posts = [];
  String? next;
  bool loading = false;
  bool loaded = false;
  Object? error;
  AdItem? ad;
}

const _tabs = ['all', 'following', 'interests', 'matches'];

class _FeedScreenState extends ConsumerState<FeedScreen> {
  final _scroll = ScrollController();
  final _pagers = {for (final t in _tabs) t: _Pager()};
  String _tab = 'all';

  _Pager get _pager => _pagers[_tab]!;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 500) _load(_tab, more: true);
    });
    _load('all');
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load(String tab, {bool more = false, bool refresh = false}) async {
    final p = _pagers[tab]!;
    if (p.loading) return;
    if (more && (p.next == null || !p.loaded)) return;
    if (!more && !refresh && p.loaded) return;
    setState(() {
      p.loading = true;
      p.error = null;
    });
    try {
      final page = await ref.read(apiProvider).feed(tab, before: more ? p.next : null);
      if (!mounted) return;
      setState(() {
        p.posts = more ? [...p.posts, ...page.posts] : page.posts;
        p.next = page.next;
        p.loaded = true;
        p.ad = more ? (p.ad ?? page.ad) : page.ad;
      });
    } catch (e) {
      if (mounted) setState(() => p.error = e);
    } finally {
      if (mounted) setState(() => p.loading = false);
    }
  }

  void _setTab(String tab) {
    if (tab == _tab) return;
    Fx.tap();
    setState(() => _tab = tab);
    _load(tab);
  }

  // Bir gönderi her sekmede güncellenir (beğeni sayısı, takip durumu); aynı yazarın diğer gönderilerinde takip durumu da
  void _update(Post updated) {
    setState(() {
      for (final pg in _pagers.values) {
        for (var i = 0; i < pg.posts.length; i++) {
          final p = pg.posts[i];
          if (p.id == updated.id) {
            pg.posts[i] = updated;
          } else if (p.author.id == updated.author.id && p.following != updated.following) {
            pg.posts[i] = p.copyWith(following: updated.following);
          }
        }
      }
    });
  }

  void _remove(String id) => setState(() {
        for (final pg in _pagers.values) {
          pg.posts.removeWhere((p) => p.id == id);
        }
      });

  void _removeAuthor(String authorId) => setState(() {
        for (final pg in _pagers.values) {
          pg.posts.removeWhere((p) => p.author.id == authorId);
        }
      });

  Future<void> _compose() async {
    if (!isVerifiedMe(ref)) return showVerifyGate(context);
    final post = await showComposePostSheet(context);
    if (post == null || !mounted) return;
    setState(() {
      for (final t in const ['all', 'following']) {
        final pg = _pagers[t]!;
        if (pg.loaded) pg.posts = [post, ...pg.posts];
      }
    });
    ref.invalidate(meProvider);
  }

  String _tabLabel(AppLocalizations l, String t) => switch (t) {
        'following' => l.feedTabFollowing,
        'interests' => l.feedTabInterests,
        'matches' => l.feedTabMatches,
        _ => l.feedTabAll,
      };

  String _emptyText(AppLocalizations l) => switch (_tab) {
        'following' => l.feedEmptyFollowing,
        'interests' => l.feedEmptyInterests,
        'matches' => l.feedEmptyMatches,
        _ => l.feedEmptyAll,
      };

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final me = ref.watch(meProvider).value;
    final pg = _pager;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(storyTrayProvider);
            await _load(_tab, refresh: true);
          },
          child: CustomScrollView(
            controller: _scroll,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 12, 4),
                  child: Row(children: [
                    Expanded(child: Text(l.navFeed, style: theme.textTheme.headlineSmall)),
                    if (me != null)
                      ActionChip(
                        avatar: const Icon(Icons.monetization_on_rounded, size: 18, color: Brand.gold),
                        label: Text(l.coins(me.balance), style: const TextStyle(fontWeight: FontWeight.w800)),
                        onPressed: () => context.go('/wallet'),
                      ),
                    const SizedBox(width: 6),
                    Semantics(
                      button: true,
                      label: l.postNew,
                      excludeSemantics: true,
                      child: GestureDetector(
                        onTap: _compose,
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(shape: BoxShape.circle, gradient: Brand.gradient),
                          child: Icon(Icons.edit_rounded, color: Brand.onAccent, size: 20),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
              const SliverToBoxAdapter(child: StoryTray()),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 44,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: _tabs.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 6),
                    itemBuilder: (_, i) {
                      final t = _tabs[i];
                      final on = t == _tab;
                      return GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => _setTab(t),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          alignment: Alignment.center,
                          padding: const EdgeInsets.symmetric(horizontal: 11),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(22),
                            gradient: on ? Brand.gradient : null,
                            color: on ? null : theme.cardTheme.color,
                            border: on ? null : Border.all(color: theme.colorScheme.outlineVariant.withValues(alpha: 0.6)),
                          ),
                          child: Text(
                            _tabLabel(l, t),
                            style: theme.textTheme.labelMedium?.copyWith(
                              fontSize: 13.5,
                              color: on ? Brand.onAccent : theme.colorScheme.onSurface,
                              fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              // "Aklından ne geçiyor?" — tek dokunuşla paylaşım kutusu
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                  child: Card(
                    margin: EdgeInsets.zero,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(Brand.radius),
                      onTap: _compose,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        child: Row(children: [
                          Avatar(me?.profile, radius: 18),
                          const SizedBox(width: 12),
                          Expanded(child: Text(l.feedComposerHint, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant))),
                          Icon(Icons.edit_note_rounded, color: theme.colorScheme.onSurfaceVariant),
                        ]),
                      ),
                    ),
                  ),
                ),
              ),
              if (pg.error != null && pg.posts.isEmpty)
                SliverFillRemaining(hasScrollBody: false, child: ErrorRetry(error: pg.error!, onRetry: () => _load(_tab, refresh: true)))
              else if (!pg.loaded && pg.posts.isEmpty)
                const SliverToBoxAdapter(child: SizedBox(height: 360, child: ListSkeleton(rows: 4)))
              else if (pg.posts.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: CenteredMessage(
                    icon: Icons.dynamic_feed_rounded,
                    text: _emptyText(l),
                    action: _tab == 'all' ? null : FilledButton.tonal(onPressed: () => _setTab('all'), child: Text(l.feedSeeAll)),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 110),
                  sliver: SliverList.separated(
                    itemCount: pg.posts.length + (pg.ad != null ? 1 : 0) + (pg.loading || pg.next != null ? 1 : 0),
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, rawIndex) {
                      // Reklam: ilk üç gönderiden sonra (gönderi azsa sona) tek bir "Sponsorlu" kart
                      final adAt = pg.ad == null ? -1 : (pg.posts.length >= 3 ? 3 : pg.posts.length);
                      if (rawIndex == adAt) return AdCard(key: ValueKey('ad-${pg.ad!.id}'), ad: pg.ad!);
                      final i = adAt >= 0 && rawIndex > adAt ? rawIndex - 1 : rawIndex;
                      if (i >= pg.posts.length) {
                        return const Padding(padding: EdgeInsets.all(16), child: Center(child: SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5))));
                      }
                      final post = pg.posts[i];
                      return PostCard(
                        key: ValueKey(post.id),
                        post: post,
                        onChanged: _update,
                        onDeleted: () => post.mine ? _remove(post.id) : _removeAuthor(post.author.id),
                        onTap: () async {
                          await context.push('/post/${post.id}');
                          // Detayda beğeni/yorum sayısı değişmiş olabilir
                          try {
                            final fresh = await ref.read(apiProvider).post(post.id);
                            if (mounted) _update(fresh);
                          } catch (_) {
                            if (mounted) _remove(post.id);
                          }
                        },
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
