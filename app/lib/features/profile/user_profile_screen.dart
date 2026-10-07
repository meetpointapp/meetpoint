import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/catalog.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/share_card.dart';
import '../../core/share_templates.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import '../call/start_call.dart';
import 'photo_viewer.dart';
import 'profile_widgets.dart';
import 'request_actions.dart';
import 'vibe_screen.dart';

// Başka bir kullanıcının profili: fotoğraflar ve sorular sırayla akar,
// altta ücretli iletişim isteği çubuğu sabit durur.
class UserProfileScreen extends ConsumerWidget {
  const UserProfileScreen({super.key, required this.userId});
  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(userProvider(userId));
    final isMe = ref.watch(sessionProvider).value?.userId == userId;
    return Scaffold(
      body: user.when(
        loading: () => const ProfileSkeleton(),
        error: (e, _) => SafeArea(child: ErrorRetry(error: e, onRetry: () => ref.invalidate(userProvider(userId)))),
        data: (p) => _ProfileBody(profile: p, isMe: isMe),
      ),
      bottomNavigationBar: user.value == null || isMe ? null : _RequestBar(profile: user.value!),
    );
  }
}

class _ProfileBody extends ConsumerWidget {
  const _ProfileBody({required this.profile, required this.isMe});
  final PublicProfile profile;
  final bool isMe;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final p = profile;
    // Ortak ilgi alanları sadece başkasının profilinde anlamlı
    final mine = isMe ? const <String>{} : ref.watch(meProvider).value?.profile?.interests.toSet() ?? const <String>{};
    final photos = p.photos;
    final prompts = p.prompts;

    // Faz 20: kompakt profil — küçük avatar başlığı + yatay fotoğraf şeridi (dokununca tam ekran büyür)
    final blocks = <Widget>[];
    Widget gap(Widget w) => Padding(padding: const EdgeInsets.only(bottom: 12), child: w);

    if (photos.length > 1) {
      blocks.add(Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: SizedBox(
          height: 148,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: photos.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (_, i) => GestureDetector(
              onTap: () => showPhotoViewer(context, photos, initial: i),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(Brand.radius),
                child: AspectRatio(aspectRatio: 3 / 4, child: NetPhoto(photos[i].thumbUrl, width: 120, height: 160)),
              ),
            ),
          ),
        ),
      ));
    }
    if (!isMe) {
      if (p.vibeArchetypeId.isNotEmpty) {
        blocks.add(gap(VibeCard(archetypeId: p.vibeArchetypeId)));
        final myArchetypeId = ref.watch(meProvider).value?.profile?.vibeArchetypeId ?? '';
        if (myArchetypeId.isNotEmpty) {
          blocks.add(gap(VibeCompatNote(myArchetypeId: myArchetypeId, otherArchetypeId: p.vibeArchetypeId)));
        }
      }
    }
    blocks.add(gap(BasicsChips(profile: p)));
    if (p.bio.isNotEmpty) blocks.add(gap(Card(child: Padding(padding: const EdgeInsets.all(18), child: Text(p.bio, style: theme.textTheme.bodyLarge)))));
    if (prompts.isNotEmpty) blocks.add(gap(PromptCard(prompt: prompts[0])));
    if (p.interests.isNotEmpty) {
      final common = p.interests.where(mine.contains).length;
      blocks.add(gap(Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(l.interests, style: theme.textTheme.titleSmall)),
              if (common > 0)
                Text(l.commonInterests(common), style: theme.textTheme.labelMedium?.copyWith(color: Brand.coral)),
            ]),
            const SizedBox(height: 10),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final id in p.interests) InterestChip(id, highlighted: mine.contains(id)),
            ]),
          ]),
        ),
      )));
    }
    if (p.musicGenres.isNotEmpty) {
      blocks.add(gap(Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(l.musicTaste, style: theme.textTheme.titleSmall),
            const SizedBox(height: 10),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final id in p.musicGenres)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: ShapeDecoration(shape: const StadiumBorder(), color: theme.colorScheme.surfaceContainerHighest),
                  child: Text('${musicEmoji[id] ?? ''} ${l.musicGenreLabel(id)}',
                      style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600)),
                ),
            ]),
          ]),
        ),
      )));
    }
    for (var i = 1; i < prompts.length; i++) {
      blocks.add(gap(PromptCard(prompt: prompts[i])));
    }

    final banner = cardGradientOf(p.cardBackgroundId.isEmpty ? 'default' : p.cardBackgroundId);
    final bannerHeight = MediaQuery.paddingOf(context).top + 116;
    // Başlık (banner + avatar) tek bir kutuda: avatar banner'ın üstüne taşar ama kutunun içinde kalır,
    // geri/menü düğmeleri en üstte sabit durur.
    return Stack(children: [
      CustomScrollView(slivers: [
        SliverToBoxAdapter(
          child: Stack(clipBehavior: Clip.none, children: [
            Container(
              height: bannerHeight,
              decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: banner)),
              child: Stack(children: [
                Positioned(right: -18, bottom: -22, child: Text('✦', style: TextStyle(fontSize: 120, color: Colors.white.withValues(alpha: 0.12)))),
                Positioned(left: 70, top: bannerHeight / 2, child: Text('✧', style: TextStyle(fontSize: 46, color: Colors.white.withValues(alpha: 0.16)))),
              ]),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(16 + 96 + 14, bannerHeight + 10, 16, 8),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 56),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  NameWithBadge(
                    '${p.displayName}, ${p.age}',
                    verified: p.verified,
                    badgeId: p.badgeId,
                    style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Wrap(spacing: 10, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
                    if (p.online)
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        Container(width: 8, height: 8, decoration: const BoxDecoration(shape: BoxShape.circle, color: Brand.like)),
                        const SizedBox(width: 5),
                        Text(l.activeNow, style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600)),
                      ]),
                    if (p.moodId.isNotEmpty)
                      Text('${moodEmoji[p.moodId] ?? ''} ${l.moodLabel(p.moodId)}', style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600)),
                    if (p.milestoneCount > 0) MilestoneBadge(p.milestoneCount),
                  ]),
                ]),
              ),
            ),
            Positioned(
              left: 16,
              top: bannerHeight - 48,
              child: GestureDetector(
                onTap: () => showPhotoViewer(context, photos),
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: theme.colorScheme.surface,
                    border: p.themeId.isEmpty ? null : Border.all(color: themeColorOf(p.themeId), width: 2.5),
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 12, offset: const Offset(0, 4))],
                  ),
                  child: Avatar(p, radius: 45),
                ),
              ),
            ),
            // Alt boşluk: avatar (96px) başlık kutusundan taşmasın
            SizedBox(height: bannerHeight + 10 + 56 + 8),
          ]),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          sliver: SliverList.list(children: blocks),
        ),
      ]),
      Positioned(
        top: 0,
        left: 0,
        right: 0,
        child: SafeArea(
          bottom: false,
          child: Row(children: [
            const _CircleBack(),
            const Spacer(),
            if (isMe) _ShareProfileButton(profile: p) else _SafetyMenu(profile: p),
          ]),
        ),
      ),
    ]);
  }
}

class _CircleBack extends StatelessWidget {
  const _CircleBack();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(8),
        child: IconButton.filled(
          style: IconButton.styleFrom(backgroundColor: Colors.black38, foregroundColor: Colors.white),
          icon: const Icon(Icons.arrow_back_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
      );
}

// Faz 17 madde 9: paylaşılabilir anlar — kendi profil kartını görsele dönüştürüp paylaş
class _ShareProfileButton extends StatelessWidget {
  const _ShareProfileButton({required this.profile});
  final PublicProfile profile;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.all(8),
      child: IconButton.filled(
        style: IconButton.styleFrom(backgroundColor: Colors.black38, foregroundColor: Colors.white),
        icon: const Icon(Icons.ios_share_rounded, size: 20),
        tooltip: l.shareButton,
        onPressed: () => shareCardImage(context, card: profileShareCard(l, profile)),
      ),
    );
  }
}

// Alttaki kompakt istek çubuğu: büyük mesaj isteği + küçük arama butonları
class _RequestBar extends ConsumerWidget {
  const _RequestBar({required this.profile});
  final PublicProfile profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final wallet = ref.watch(walletProvider).value;
    final prices = wallet?.requestPrices;
    final rates = wallet?.callRates;
    final theme = Theme.of(context);

    Widget callButton(CallKind kind) => SizedBox(
          width: 64,
          child: Material(
            color: theme.colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(Brand.radius),
            child: InkWell(
              borderRadius: BorderRadius.circular(Brand.radius),
              onTap: () => startCallFlow(context, ref, profile, kind),
              child: Semantics(
                button: true,
                label: callKindLabel(l, kind),
                child: SizedBox(
                  height: 52,
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(callKindIcon(kind), size: 20, color: Brand.coral),
                    if (rates?[kind] != null)
                      Text(l.perMinute(rates![kind]!),
                          style: theme.textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w700)),
                  ]),
                ),
              ),
            ),
          ),
        );

    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 12, offset: const Offset(0, -2))],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: Row(children: [
            Expanded(
              child: GradientButton(
                icon: Icons.mail_rounded,
                label: prices?[RequestKind.message] == null
                    ? l.messageRequest
                    : '${l.messageRequest} · ${prices![RequestKind.message]}',
                onPressed: () => sendContactRequest(context, ref, profile, RequestKind.message),
              ),
            ),
            const SizedBox(width: 8),
            callButton(CallKind.voice),
            const SizedBox(width: 8),
            callButton(CallKind.video),
          ]),
        ),
      ),
    );
  }
}

class _SafetyMenu extends ConsumerWidget {
  const _SafetyMenu({required this.profile});
  final PublicProfile profile;

  Future<void> _block(BuildContext context, WidgetRef ref) async {
    final l = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(l.blockConfirm(profile.displayName)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.block)),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(apiProvider).block(profile.id);
      ref.invalidate(conversationsProvider);
      if (context.mounted) {
        showSnack(context, l.blocked);
        context.pop();
      }
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(l, e));
    }
  }

  Future<void> _report(BuildContext context, WidgetRef ref) async {
    final l = AppLocalizations.of(context);
    final reasons = {
      'fake_profile': l.reportFake,
      'inappropriate_content': l.reportInappropriate,
      'harassment': l.reportHarassment,
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
      await ref.read(apiProvider).report(profile.id, reason);
      if (context.mounted) showSnack(context, l.reportSent);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.all(8),
      child: PopupMenuButton<String>(
        icon: const CircleAvatar(
          radius: 18,
          backgroundColor: Colors.black38,
          child: Icon(Icons.more_horiz_rounded, color: Colors.white, size: 20),
        ),
        onSelected: (v) => v == 'block' ? _block(context, ref) : _report(context, ref),
        itemBuilder: (_) => [
          PopupMenuItem(value: 'report', child: Text(l.report)),
          PopupMenuItem(value: 'block', child: Text(l.block)),
        ],
      ),
    );
  }
}
