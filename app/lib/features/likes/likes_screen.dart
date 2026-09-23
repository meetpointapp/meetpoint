import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Seni beğenenler: kilitliyken sayı + bulanık önizleme, açıkken geri beğen/geç
class LikesScreen extends ConsumerStatefulWidget {
  const LikesScreen({super.key});

  @override
  ConsumerState<LikesScreen> createState() => _LikesScreenState();
}

class _LikesScreenState extends ConsumerState<LikesScreen> {
  bool _busy = false;

  Future<void> _unlock() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).unlockLikes();
      ref.invalidate(likesProvider);
      ref.invalidate(walletProvider);
      ref.invalidate(meProvider);
    } catch (e) {
      if (!mounted) return;
      final low = e is ApiException && e.code == 'insufficient_balance';
      showSnack(context, errorText(l, e),
          action: low ? SnackBarAction(label: l.topUp, onPressed: () => context.go('/wallet')) : null);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _respond(PublicProfile p, bool like) async {
    final l = AppLocalizations.of(context);
    try {
      final r = await ref.read(apiProvider).swipe(p.id, like ? 'like' : 'pass');
      ref.invalidate(likesProvider);
      if (r.match) {
        ref.invalidate(conversationsProvider);
        if (mounted) {
          showSnack(context, l.newMatchWith(p.displayName));
          context.push('/chat/${r.conversationId}');
        }
      }
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final likes = ref.watch(likesProvider);
    final price = ref.watch(walletProvider).value?.featurePrices;

    return Scaffold(
      appBar: AppBar(title: Text(l.likesYou)),
      body: likes.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(likesProvider)),
        data: (info) {
          if (info.count == 0) {
            return CenteredMessage(icon: Icons.favorite_border_rounded, text: l.noLikesYet);
          }
          if (!info.unlocked) {
            return ListView(padding: const EdgeInsets.all(16), children: [
              Text(l.likesYouCount(info.count), style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 6),
              Text(l.likesLockedBody(price?.likesUnlockHours ?? 24),
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
              const SizedBox(height: 20),
              _LockedGrid(count: info.count.clamp(1, 6)),
              const SizedBox(height: 20),
              GradientButton(
                icon: Icons.visibility_rounded,
                label: price == null ? l.seeWhoLikes : '${l.seeWhoLikes} · ${l.coins(price.likesUnlock)}',
                busy: _busy,
                onPressed: _unlock,
              ),
            ]);
          }
          return GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 3 / 4.4,
            ),
            itemCount: info.users.length,
            itemBuilder: (_, i) => _LikeCard(
              profile: info.users[i],
              onPass: () => _respond(info.users[i], false),
              onLike: () => _respond(info.users[i], true),
            ),
          );
        },
      ),
    );
  }
}

// Kilitli önizleme: fotoğraf verisi gönderilmez, sadece bulanık görünümlü kartlar
class _LockedGrid extends StatelessWidget {
  const _LockedGrid({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) => GridView.count(
        crossAxisCount: 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 3 / 4,
        children: [
          for (var i = 0; i < count; i++)
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Brand.coral.withValues(alpha: 0.35 + (i % 3) * 0.1),
                    Brand.orange.withValues(alpha: 0.25 + (i % 2) * 0.15),
                  ],
                ),
              ),
              child: const Center(child: Icon(Icons.lock_rounded, color: Colors.white, size: 28)),
            ),
        ],
      );
}

class _LikeCard extends StatelessWidget {
  const _LikeCard({required this.profile, required this.onPass, required this.onLike});
  final PublicProfile profile;
  final VoidCallback onPass;
  final VoidCallback onLike;

  @override
  Widget build(BuildContext context) {
    final p = profile;
    return GestureDetector(
      onTap: () => context.push('/user/${p.id}'),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Brand.radius),
        child: Stack(fit: StackFit.expand, children: [
          NetPhoto(p.coverUrl),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.center,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Colors.black87],
              ),
            ),
          ),
          if (p.superLikedMe)
            const Positioned(top: 8, left: 8, child: _SuperBadge()),
          Positioned(
            left: 10,
            right: 10,
            bottom: 10,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              NameWithBadge('${p.displayName}, ${p.age}',
                  verified: p.verified,
                  onPhoto: true,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(child: _MiniButton(icon: Icons.close_rounded, color: Brand.nope, onTap: onPass)),
                const SizedBox(width: 8),
                Expanded(child: _MiniButton(icon: Icons.favorite_rounded, gradient: true, onTap: onLike)),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _SuperBadge extends StatelessWidget {
  const _SuperBadge();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: const ShapeDecoration(shape: StadiumBorder(), color: Color(0xFF2F80ED)),
        child: const Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.star_rounded, color: Colors.white, size: 14),
        ]),
      );
}

class _MiniButton extends StatelessWidget {
  const _MiniButton({required this.icon, required this.onTap, this.color, this.gradient = false});
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;
  final bool gradient;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: ShapeDecoration(
          shape: const StadiumBorder(),
          gradient: gradient ? Brand.gradient : null,
          color: gradient ? null : Colors.white,
        ),
        child: Material(
          type: MaterialType.transparency,
          shape: const StadiumBorder(),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: onTap,
            child: SizedBox(height: 34, child: Icon(icon, size: 20, color: gradient ? Colors.white : color)),
          ),
        ),
      );
}
