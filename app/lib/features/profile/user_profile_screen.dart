import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import '../call/start_call.dart';
import 'profile_widgets.dart';
import 'request_actions.dart';

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

    // Fotoğraflar ile soruları sırayla birleştir: foto, soru, foto, etiketler, soru...
    final blocks = <Widget>[];
    Widget photo(Photo ph) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(Brand.radius),
            child: AspectRatio(aspectRatio: 4 / 5, child: NetPhoto(ph.url)),
          ),
        );
    Widget gap(Widget w) => Padding(padding: const EdgeInsets.only(bottom: 12), child: w);

    blocks.add(gap(BasicsChips(profile: p)));
    if (p.bio.isNotEmpty) blocks.add(gap(Card(child: Padding(padding: const EdgeInsets.all(18), child: Text(p.bio, style: theme.textTheme.bodyLarge)))));
    if (prompts.isNotEmpty) blocks.add(gap(PromptCard(prompt: prompts[0])));
    if (photos.length > 1) blocks.add(photo(photos[1]));
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
    for (var i = 1; i < prompts.length; i++) {
      blocks.add(gap(PromptCard(prompt: prompts[i])));
      if (photos.length > i + 1) blocks.add(photo(photos[i + 1]));
    }
    for (var i = prompts.length.clamp(1, 99) + 1; i < photos.length; i++) {
      blocks.add(photo(photos[i]));
    }

    return CustomScrollView(slivers: [
      SliverAppBar(
        pinned: true,
        stretch: true,
        expandedHeight: MediaQuery.sizeOf(context).width * 1.15,
        foregroundColor: Colors.white,
        backgroundColor: theme.colorScheme.surface,
        leading: const _CircleBack(),
        actions: [if (!isMe) _SafetyMenu(profile: p)],
        flexibleSpace: FlexibleSpaceBar(
          background: Stack(fit: StackFit.expand, children: [
            NetPhoto(p.coverUrl),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.center,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.black54],
                ),
              ),
            ),
            Positioned(
              left: 20,
              right: 20,
              bottom: 18,
              child: NameWithBadge(
                '${p.displayName}, ${p.age}',
                verified: p.verified,
                onPhoto: true,
                style: theme.textTheme.headlineMedium?.copyWith(color: Colors.white),
              ),
            ),
          ]),
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        sliver: SliverList.list(children: blocks),
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
