import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import '../profile/profile_widgets.dart';

// Faz 22: sosyal akış — gönderi kartı, takip düğmesi ve ortak yardımcılar.

String timeAgo(AppLocalizations l, DateTime t) {
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return l.timeNow;
  if (d.inMinutes < 60) return l.timeMinutes(d.inMinutes);
  if (d.inHours < 24) return l.timeHours(d.inHours);
  return l.timeDays(d.inDays);
}

// Metin hikayelerinin zeminleri. Kimlikler sunucudaki social.storyBackgrounds ile aynı olmalı.
const storyGradients = <String, List<Color>>{
  'sunset': [Color(0xFFFF4D6D), Color(0xFFFF8A5B)],
  'ocean': [Color(0xFF2F80ED), Color(0xFF56CCF2)],
  'forest': [Color(0xFF11998E), Color(0xFF38EF7D)],
  'grape': [Color(0xFF8E2DE2), Color(0xFF4A00E0)],
  'night': [Color(0xFF232526), Color(0xFF414345)],
  'rose': [Color(0xFFEC008C), Color(0xFFFC6767)],
  'gold': [Color(0xFFF7971E), Color(0xFFFFD200)],
};

List<Color> storyGradientOf(String id) => storyGradients[id] ?? storyGradients['sunset']!;

// Açık zeminlerde (altın) koyu yazı
Color storyTextColorOf(String id) => id == 'gold' ? const Color(0xFF2A1B00) : Colors.white;

// Yazma (gönderi, yorum, hikaye) mavi tikli hesaplara açık
bool isVerifiedMe(WidgetRef ref) => ref.read(meProvider).value?.verificationStatus == 'approved';

Future<void> showVerifyGate(BuildContext context) async {
  final l = AppLocalizations.of(context);
  final go = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      icon: const Icon(Icons.verified_rounded, color: Color(0xFF2F80ED), size: 36),
      title: Text(l.verifyToPostTitle),
      content: Text(l.verifyToPostBody, textAlign: TextAlign.center),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.verifyProfile)),
      ],
    ),
  );
  if (go == true && context.mounted) context.push('/verify-profile');
}

// İçerik şikayeti: neden seçilir, sunucuya gider
Future<void> reportContent(BuildContext context, WidgetRef ref, {required String type, required String id}) async {
  final l = AppLocalizations.of(context);
  final reasons = {
    'harassment': l.reportHarassment,
    'inappropriate_content': l.reportInappropriate,
    'scam': l.reportScam,
    'underage': l.reportUnderage,
    'other': l.reportOther,
  };
  final reason = await showModalBottomSheet<String>(
    context: context,
    builder: (ctx) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(title: Text(l.reportTitle, style: Theme.of(ctx).textTheme.titleMedium)),
        for (final e in reasons.entries) ListTile(title: Text(e.value), onTap: () => Navigator.pop(ctx, e.key)),
      ]),
    ),
  );
  if (reason == null) return;
  try {
    await ref.read(apiProvider).reportContent(type, id, reason);
    if (context.mounted) showSnack(context, l.reportSent);
  } catch (e) {
    if (context.mounted) showSnack(context, errorText(l, e));
  }
}

// Takip et / Takiptesin. Takipleşme (karşılıklı) durumunda küçük bir vurgu.
class FollowButton extends ConsumerStatefulWidget {
  const FollowButton({super.key, required this.userId, required this.following, this.followsMe = false, this.onChanged, this.dense = true});
  final String userId;
  final bool following;
  final bool followsMe;
  final ValueChanged<SocialStats>? onChanged;
  final bool dense;

  @override
  ConsumerState<FollowButton> createState() => _FollowButtonState();
}

class _FollowButtonState extends ConsumerState<FollowButton> {
  bool _busy = false;
  late bool _following = widget.following;

  @override
  void didUpdateWidget(covariant FollowButton old) {
    super.didUpdateWidget(old);
    if (old.following != widget.following) _following = widget.following;
  }

  Future<void> _toggle() async {
    if (_busy) return;
    final l = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _following = !_following;
    });
    try {
      final api = ref.read(apiProvider);
      final stats = _following ? await api.follow(widget.userId) : await api.unfollow(widget.userId);
      ref.invalidate(storyTrayProvider);
      ref.invalidate(meProvider);
      widget.onChanged?.call(stats);
    } catch (e) {
      if (mounted) {
        setState(() => _following = !_following);
        showSnack(context, errorText(l, e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final label = _following ? l.followingState : (widget.followsMe ? l.followBack : l.follow);
    final h = widget.dense ? 32.0 : 40.0;
    if (_following) {
      return SizedBox(
        height: h,
        child: OutlinedButton(
          onPressed: _toggle,
          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12), minimumSize: Size(0, h), visualDensity: VisualDensity.compact),
          child: Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
        ),
      );
    }
    return SizedBox(
      height: h,
      child: DecoratedBox(
        decoration: ShapeDecoration(shape: const StadiumBorder(), gradient: Brand.gradient),
        child: TextButton(
          onPressed: _toggle,
          style: TextButton.styleFrom(
            foregroundColor: Brand.onAccent,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            minimumSize: Size(0, h),
            shape: const StadiumBorder(),
            visualDensity: VisualDensity.compact,
          ),
          child: Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800)),
        ),
      ),
    );
  }
}

// Akıştaki / profildeki / detaydaki gönderi kartı
class PostCard extends ConsumerStatefulWidget {
  const PostCard({super.key, required this.post, required this.onChanged, this.onDeleted, this.onTap, this.detail = false});
  final Post post;
  final ValueChanged<Post> onChanged;
  final VoidCallback? onDeleted;
  final VoidCallback? onTap;
  final bool detail; // gönderi detayında: yazı büyük, kart çerçevesiz

  @override
  ConsumerState<PostCard> createState() => _PostCardState();
}

class _PostCardState extends ConsumerState<PostCard> {
  bool _likeBusy = false;

  Future<void> _like() async {
    if (_likeBusy) return;
    final p = widget.post;
    final l = AppLocalizations.of(context);
    setState(() => _likeBusy = true);
    // İyimser güncelleme
    widget.onChanged(p.copyWith(likedByMe: !p.likedByMe, likeCount: (p.likeCount + (p.likedByMe ? -1 : 1)).clamp(0, 1 << 30)));
    try {
      final api = ref.read(apiProvider);
      final r = p.likedByMe ? await api.unlikePost(p.id) : await api.likePost(p.id);
      widget.onChanged(p.copyWith(likedByMe: r.liked, likeCount: r.likeCount));
    } catch (e) {
      widget.onChanged(p);
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _likeBusy = false);
    }
  }

  Future<void> _delete() async {
    final l = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(l.postDeleteConfirm),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.postDelete)),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(apiProvider).deletePost(widget.post.id);
      ref.invalidate(meProvider);
      widget.onDeleted?.call();
      if (mounted) showSnack(context, l.postDeleted);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  Future<void> _block() async {
    final l = AppLocalizations.of(context);
    final name = widget.post.author.displayName;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(l.blockConfirm(name)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.block)),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(apiProvider).block(widget.post.author.id);
      ref.invalidate(conversationsProvider);
      ref.invalidate(storyTrayProvider);
      widget.onDeleted?.call();
      if (mounted) showSnack(context, l.blocked);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final p = widget.post;
    final a = p.author;
    final detail = widget.detail;

    final content = Padding(
      padding: EdgeInsets.fromLTRB(14, 12, 6, detail ? 8 : 6),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          GestureDetector(onTap: () => context.push('/user/${a.id}'), child: Avatar(a, radius: 22)),
          const SizedBox(width: 10),
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => context.push('/user/${a.id}'),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                NameWithBadge(a.displayName,
                    verified: a.verified,
                    premium: a.premium,
                    badgeId: a.badgeId,
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                Text(timeAgo(l, p.createdAt), style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              ]),
            ),
          ),
          if (!p.mine && !p.following)
            Padding(padding: const EdgeInsets.only(right: 4), child: FollowButton(userId: a.id, following: p.following, onChanged: (s) => widget.onChanged(p.copyWith(following: s.isFollowing)))),
          PopupMenuButton<String>(
            icon: Icon(Icons.more_horiz_rounded, color: theme.colorScheme.onSurfaceVariant),
            onSelected: (v) {
              switch (v) {
                case 'delete':
                  _delete();
                case 'report':
                  reportContent(context, ref, type: 'posts', id: p.id);
                case 'block':
                  _block();
                case 'unfollow':
                  ref.read(apiProvider).unfollow(a.id).then((_) {
                    ref.invalidate(storyTrayProvider);
                    widget.onChanged(p.copyWith(following: false));
                  });
              }
            },
            itemBuilder: (_) => [
              if (p.mine) PopupMenuItem(value: 'delete', child: Text(l.postDelete)),
              if (!p.mine && p.following) PopupMenuItem(value: 'unfollow', child: Text(l.unfollow)),
              if (!p.mine) PopupMenuItem(value: 'report', child: Text(l.postReport)),
              if (!p.mine) PopupMenuItem(value: 'block', child: Text(l.block)),
            ],
          ),
        ]),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: SelectionContainer.disabled(
            child: Text(p.body, style: (detail ? theme.textTheme.titleMedium : theme.textTheme.bodyLarge)?.copyWith(height: 1.42, fontWeight: FontWeight.w500)),
          ),
        ),
        if (p.interest.isNotEmpty) ...[
          const SizedBox(height: 10),
          Align(alignment: Alignment.centerLeft, child: InterestChip(p.interest)),
        ],
        const SizedBox(height: 6),
        Row(children: [
          _Action(
            icon: p.likedByMe ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            color: p.likedByMe ? Brand.coral : theme.colorScheme.onSurfaceVariant,
            count: p.likeCount,
            onTap: _like,
            tooltip: l.postLike,
          ),
          const SizedBox(width: 6),
          _Action(
            icon: Icons.chat_bubble_outline_rounded,
            color: theme.colorScheme.onSurfaceVariant,
            count: p.commentCount,
            onTap: widget.onTap,
            tooltip: l.commentsTitle,
          ),
        ]),
      ]),
    );

    if (detail) return content;
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(borderRadius: BorderRadius.circular(Brand.radius), onTap: widget.onTap, child: content),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.color, required this.count, required this.onTap, required this.tooltip});
  final IconData icon;
  final Color color;
  final int count;
  final VoidCallback? onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: '$tooltip $count',
        excludeSemantics: true,
        onTap: onTap,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, size: 21, color: color),
              if (count > 0) ...[
                const SizedBox(width: 6),
                Text('$count', style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 13)),
              ],
            ]),
          ),
        ),
      );
}

// Takipçi · Takip · Gönderi sayıları (dokununca listeler). Başkasının profilinde takip düğmesi de burada.
class SocialCounts extends ConsumerStatefulWidget {
  const SocialCounts({super.key, required this.userId, required this.stats, this.isMe = false});
  final String userId;
  final SocialStats stats;
  final bool isMe;

  @override
  ConsumerState<SocialCounts> createState() => _SocialCountsState();
}

class _SocialCountsState extends ConsumerState<SocialCounts> {
  late SocialStats _s = widget.stats;

  @override
  void didUpdateWidget(covariant SocialCounts old) {
    super.didUpdateWidget(old);
    if (old.stats != widget.stats) _s = widget.stats;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    Widget count(int n, String label, VoidCallback onTap) {
      final cell = InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('$n', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
            Text(label, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ]),
        ),
      );
      // Kendi sayfamda üç sayaç satırı eşit paylaşır
      return widget.isMe ? Expanded(child: cell) : cell;
    }
    return Row(children: [
      count(_s.followers, l.followersLabel, () => context.push('/user/${widget.userId}/followers')),
      count(_s.following, l.followingLabel, () => context.push('/user/${widget.userId}/following')),
      count(_s.posts, l.postsLabel, () => context.push('/user/${widget.userId}/posts')),
      if (!widget.isMe) const Spacer(),
      if (!widget.isMe)
        Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
          FollowButton(
            userId: widget.userId,
            following: _s.isFollowing,
            followsMe: _s.followsMe,
            dense: false,
            onChanged: (n) => setState(() => _s = n),
          ),
          if (_s.mutual)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(l.mutualFollow, style: theme.textTheme.labelSmall?.copyWith(color: Brand.coral, fontWeight: FontWeight.w700)),
            ),
        ]),
    ]);
  }
}

// Profil sayfasında son gönderilerin kısa önizlemesi
class PostsPreview extends ConsumerStatefulWidget {
  const PostsPreview({super.key, required this.userId, required this.total});
  final String userId;
  final int total;

  @override
  ConsumerState<PostsPreview> createState() => _PostsPreviewState();
}

class _PostsPreviewState extends ConsumerState<PostsPreview> {
  List<Post>? _posts;

  @override
  void initState() {
    super.initState();
    ref.read(apiProvider).userPosts(widget.userId).then((p) {
      if (mounted) setState(() => _posts = p.posts.take(3).toList());
    }).catchError((_) {
      if (mounted) setState(() => _posts = const []);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final posts = _posts;
    if (posts == null || posts.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        child: Row(children: [
          Expanded(child: Text(l.postsTitle, style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800))),
          if (widget.total > posts.length) TextButton(onPressed: () => context.push('/user/${widget.userId}/posts'), child: Text(l.seeAllPosts(widget.total))),
        ]),
      ),
      for (var i = 0; i < posts.length; i++) ...[
        PostCard(
          post: posts[i],
          onChanged: (u) => setState(() => posts[i] = u),
          onDeleted: () => setState(() => posts.removeAt(i)),
          onTap: () => context.push('/post/${posts[i].id}'),
        ),
        const SizedBox(height: 10),
      ],
    ]);
  }
}
