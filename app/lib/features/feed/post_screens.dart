import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import 'social_widgets.dart';

// Faz 22: gönderi detayı — gönderi + yorumlar. Yorum yazma mavi tikli hesaplara açık.
class PostDetailScreen extends ConsumerStatefulWidget {
  const PostDetailScreen({super.key, required this.postId});
  final String postId;

  @override
  ConsumerState<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends ConsumerState<PostDetailScreen> {
  Post? _post;
  Object? _error;
  List<PostComment> _comments = [];
  String? _next;
  bool _loadingMore = false;
  final _input = TextEditingController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiProvider);
      final results = await Future.wait([api.post(widget.postId), api.postComments(widget.postId)]);
      if (!mounted) return;
      final c = results[1] as ({List<PostComment> comments, String? next});
      setState(() {
        _post = results[0] as Post;
        _comments = c.comments;
        _next = c.next;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _more() async {
    if (_next == null || _loadingMore) return;
    setState(() => _loadingMore = true);
    try {
      final c = await ref.read(apiProvider).postComments(widget.postId, after: _next);
      if (mounted) {
        setState(() {
          _comments = [..._comments, ...c.comments];
          _next = c.next;
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _send() async {
    final l = AppLocalizations.of(context);
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final c = await ref.read(apiProvider).addComment(widget.postId, text);
      if (!mounted) return;
      setState(() {
        _comments = [..._comments, c];
        _post = _post?.copyWith(commentCount: _post!.commentCount + 1);
        _input.clear();
      });
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _deleteComment(PostComment c) async {
    final l = AppLocalizations.of(context);
    try {
      await ref.read(apiProvider).deleteComment(c.id);
      if (!mounted) return;
      setState(() {
        _comments = _comments.where((x) => x.id != c.id).toList();
        _post = _post?.copyWith(commentCount: (_post!.commentCount - 1).clamp(0, 1 << 30));
      });
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final verified = ref.watch(meProvider).value?.verificationStatus == 'approved';
    final post = _post;

    return Scaffold(
      appBar: AppBar(title: Text(l.postTitle)),
      body: _error != null && post == null
          ? ErrorRetry(error: _error!, onRetry: _load)
          : post == null
              ? const ListSkeleton(rows: 3)
              : Column(children: [
                  Expanded(
                    child: ListView(padding: const EdgeInsets.fromLTRB(12, 0, 12, 16), children: [
                      Card(
                        margin: EdgeInsets.zero,
                        child: PostCard(
                          post: post,
                          showPinned: true,
                          detail: true,
                          onChanged: (p) => setState(() => _post = p),
                          onDeleted: () {
                            if (context.canPop()) context.pop();
                          },
                        ),
                      ),
                      const SizedBox(height: 14),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Text(l.commentsTitle, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(height: 8),
                      if (_comments.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 28),
                          child: Center(child: Text(l.commentsEmpty, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant))),
                        )
                      else
                        for (final c in _comments) _CommentTile(comment: c, onDelete: c.canDelete ? () => _deleteComment(c) : null, onReport: () => reportContent(context, ref, type: 'comments', id: c.id)),
                      if (_next != null)
                        TextButton(onPressed: _more, child: _loadingMore ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : Text(l.commentsMore)),
                    ]),
                  ),
                  // Yorum yazma: sadece mavi tikliler; diğerleri nedenini görür
                  SafeArea(
                    top: false,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
                      decoration: BoxDecoration(
                        color: theme.cardTheme.color,
                        border: Border(top: BorderSide(color: theme.colorScheme.outlineVariant.withValues(alpha: 0.5))),
                      ),
                      child: verified
                          ? Row(children: [
                              Expanded(
                                child: TextField(
                                  controller: _input,
                                  minLines: 1,
                                  maxLines: 4,
                                  maxLength: 240,
                                  textInputAction: TextInputAction.send,
                                  buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                                  onSubmitted: (_) => _send(),
                                  decoration: InputDecoration(hintText: l.commentHint, isDense: true),
                                ),
                              ),
                              const SizedBox(width: 6),
                              IconButton.filled(
                                onPressed: _sending ? null : _send,
                                style: IconButton.styleFrom(backgroundColor: Brand.coral, foregroundColor: Brand.onAccent),
                                icon: _sending
                                    ? SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Brand.onAccent))
                                    : const Icon(Icons.send_rounded, size: 20),
                              ),
                            ])
                          : Row(children: [
                              const Icon(Icons.verified_outlined, color: Color(0xFF2F80ED)),
                              const SizedBox(width: 10),
                              Expanded(child: Text(l.commentVerifiedOnly, style: theme.textTheme.bodySmall)),
                              TextButton(onPressed: () => context.push('/verify-profile'), child: Text(l.verifyProfile)),
                            ]),
                    ),
                  ),
                ]),
    );
  }
}

class _CommentTile extends StatelessWidget {
  const _CommentTile({required this.comment, required this.onDelete, required this.onReport});
  final PostComment comment;
  final VoidCallback? onDelete;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final a = comment.author;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GestureDetector(onTap: () => context.push('/user/${a.id}'), child: Avatar(a, radius: 18)),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
            decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.55), borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: Row(children: [
                    Flexible(child: NameWithBadge(a.displayName, verified: a.verified, premium: a.premium, badgeId: a.badgeId, style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800))),
                    const SizedBox(width: 8),
                    Text(timeAgo(l, comment.createdAt), style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  ]),
                ),
                PopupMenuButton<String>(
                  padding: EdgeInsets.zero,
                  icon: Icon(Icons.more_horiz_rounded, size: 18, color: theme.colorScheme.onSurfaceVariant),
                  onSelected: (v) => v == 'delete' ? onDelete?.call() : onReport(),
                  itemBuilder: (_) => [
                    if (onDelete != null) PopupMenuItem(value: 'delete', child: Text(l.commentDelete)),
                    if (!comment.mine) PopupMenuItem(value: 'report', child: Text(l.postReport)),
                  ],
                ),
              ]),
              Padding(padding: const EdgeInsets.only(right: 8, bottom: 2), child: Text(comment.body, style: theme.textTheme.bodyMedium?.copyWith(height: 1.35))),
            ]),
          ),
        ),
      ]),
    );
  }
}

// Bir kullanıcının gönderileri (profilden)
class UserPostsScreen extends ConsumerStatefulWidget {
  const UserPostsScreen({super.key, required this.userId});
  final String userId;

  @override
  ConsumerState<UserPostsScreen> createState() => _UserPostsScreenState();
}

class _UserPostsScreenState extends ConsumerState<UserPostsScreen> {
  List<Post> _posts = [];
  String? _next;
  bool _loading = true;
  Object? _error;
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400) _load(more: true);
    });
    _load();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({bool more = false}) async {
    if (more && (_next == null || _loading)) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref.read(apiProvider).userPosts(widget.userId, before: more ? _next : null);
      if (mounted) {
        setState(() {
          _posts = more ? [..._posts, ...page.posts] : page.posts;
          _next = page.next;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.postsTitle)),
      body: _error != null && _posts.isEmpty
          ? ErrorRetry(error: _error!, onRetry: _load)
          : _loading && _posts.isEmpty
              ? const ListSkeleton(rows: 4)
              : _posts.isEmpty
                  ? CenteredMessage(icon: Icons.dynamic_feed_rounded, text: l.postsEmpty)
                  : ListView.separated(
                      controller: _scroll,
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                      itemCount: _posts.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (_, i) {
                        final p = _posts[i];
                        return PostCard(
                          showPinned: true,
                          post: p,
                          onChanged: (u) => setState(() => _posts[i] = u),
                          onDeleted: () => setState(() => _posts.removeAt(i)),
                          onTap: () => context.push('/post/${p.id}'),
                        );
                      },
                    ),
    );
  }
}

// Takipçi / takip edilen listesi
class FollowListScreen extends ConsumerStatefulWidget {
  const FollowListScreen({super.key, required this.userId, required this.followers});
  final String userId;
  final bool followers;

  @override
  ConsumerState<FollowListScreen> createState() => _FollowListScreenState();
}

class _FollowListScreenState extends ConsumerState<FollowListScreen> {
  List<FollowUser> _users = [];
  String? _next;
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool more = false}) async {
    if (more && _next == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await ref.read(apiProvider).followList(widget.userId, followers: widget.followers, after: more ? _next : null);
      if (mounted) {
        setState(() {
          _users = more ? [..._users, ...r.users] : r.users;
          _next = r.next;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final myId = ref.watch(sessionProvider).value?.userId;
    return Scaffold(
      appBar: AppBar(title: Text(widget.followers ? l.followersTitle : l.followingTitle)),
      body: _error != null && _users.isEmpty
          ? ErrorRetry(error: _error!, onRetry: _load)
          : _loading && _users.isEmpty
              ? const ListSkeleton(rows: 6)
              : _users.isEmpty
                  ? CenteredMessage(icon: Icons.group_outlined, text: widget.followers ? l.noFollowers : l.noFollowing)
                  : ListView.builder(
                      itemCount: _users.length + (_next != null ? 1 : 0),
                      itemBuilder: (_, i) {
                        if (i >= _users.length) {
                          _load(more: true);
                          return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2.5)));
                        }
                        final u = _users[i];
                        final p = u.user;
                        return ListTile(
                          leading: Avatar(p, radius: 24),
                          title: NameWithBadge(p.displayName, verified: p.verified, premium: p.premium, badgeId: p.badgeId),
                          subtitle: u.isFollowing && u.followsMe ? Text(l.mutualFollow, style: TextStyle(color: Brand.coral, fontWeight: FontWeight.w600, fontSize: theme.textTheme.bodySmall?.fontSize)) : null,
                          trailing: p.id == myId ? null : FollowButton(userId: p.id, following: u.isFollowing, followsMe: u.followsMe),
                          onTap: () => context.push('/user/${p.id}'),
                        );
                      },
                    ),
    );
  }
}
