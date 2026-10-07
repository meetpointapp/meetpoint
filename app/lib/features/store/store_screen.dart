import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/catalog.dart';
import '../../core/cosmetics.dart';
import '../../core/fx.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 16/20: kozmetik mağaza. Jetonla alınan sohbet balonu/arka planı, çerçeve, rozet, premium tema — kullanıcıdan kullanıcıya geçmez, tamamı platform geliri. Alt menüde kendi
// sekmesi var; her ürün canlı önizlemeyle gösterilir ve alındıktan sonra doğrudan buradan "Kullan"
// ile uygulanır (profil düzenlemeye gitmeye gerek yok).
const _categories = <(String, String)>[
  ('chatBubble', '💬'),
  ('chatBackground', '🖼️'),
  ('frame', '⭕'),
  ('badge', '🏅'),
  ('theme', '🎨'),
];

class StoreScreen extends ConsumerStatefulWidget {
  const StoreScreen({super.key});

  @override
  ConsumerState<StoreScreen> createState() => _StoreScreenState();
}

class _StoreScreenState extends ConsumerState<StoreScreen> {
  String _category = 'chatBubble';
  String? _busy;

  Future<void> _buy(StoreItem item) async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = item.id);
    try {
      await ref.read(apiProvider).purchaseItem(item.id);
      ref.invalidate(storeItemsProvider);
      ref.invalidate(walletProvider);
      ref.invalidate(meProvider);
      Fx.success();
      if (mounted) showSnack(context, l.storePurchased);
    } catch (e) {
      if (!mounted) return;
      final low = e is ApiException && e.code == 'insufficient_balance';
      showSnack(context, errorText(l, e), action: low ? SnackBarAction(label: l.topUp, onPressed: () => context.go('/wallet')) : null);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  // Satın alınmış ürünü profile uygula (on=false: kaldır, varsayılana dön)
  Future<void> _equip(StoreItem item, {required bool on}) async {
    final l = AppLocalizations.of(context);
    final profile = ref.read(meProvider).value?.profile;
    if (profile == null) return;
    setState(() => _busy = item.id);
    try {
      final d = ProfileDraft.from(profile);
      final id = on ? item.id : '';
      switch (item.category) {
        case 'frame':
          d.frameId = id;
        case 'badge':
          d.badgeId = id;
        case 'theme':
          d.themeId = id;
        case 'chatBubble':
          d.chatBubbleThemeId = id;
        case 'chatBackground':
          d.chatBackgroundThemeId = id;
      }
      await ref.read(apiProvider).saveProfile(d.toJson());
      ref.invalidate(meProvider);
      Fx.tap();
      if (mounted) showSnack(context, on ? l.storeEquippedSnack : l.storeRemovedSnack);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  String _equippedId(String category, MyProfile? p) => switch (category) {
        'frame' => p?.frameId ?? '',
        'badge' => p?.badgeId ?? '',
        'theme' => p?.themeId ?? '',
        'chatBubble' => p?.chatBubbleThemeId ?? '',
        'chatBackground' => p?.chatBackgroundThemeId ?? '',
        _ => '',
      };

  String _categoryTitle(AppLocalizations l, String category) => switch (category) {
        'frame' => l.storeCategoryFrame,
        'badge' => l.storeCategoryBadge,
        'theme' => l.storeCategoryTheme,
        'chatBubble' => l.storeCategoryChatBubble,
        'chatBackground' => l.storeCategoryChatBackground,
        _ => category,
      };

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final items = ref.watch(storeItemsProvider);
    final me = ref.watch(meProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: Text(l.storeTitle),
        actions: [
          if (me != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: ActionChip(
                avatar: const Icon(Icons.monetization_on_rounded, size: 18, color: Brand.gold),
                label: Text(l.coins(me.balance), style: const TextStyle(fontWeight: FontWeight.w800)),
                onPressed: () => context.go('/wallet'),
              ),
            ),
        ],
      ),
      body: items.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(storeItemsProvider)),
        data: (list) {
          final inCategory = list.where((i) => i.category == _category).toList();
          final ownedCount = list.where((i) => i.owned).length;
          final equipped = _equippedId(_category, me?.profile);
          return CustomScrollView(slivers: [
            SliverToBoxAdapter(child: _Hero(ownedCount: ownedCount, total: list.length)),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 52,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  itemCount: _categories.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final (id, emoji) = _categories[i];
                    final on = id == _category;
                    return GestureDetector(
                      onTap: () => setState(() => _category = id),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 160),
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(20),
                          gradient: on ? Brand.gradient : null,
                          color: on ? null : theme.cardTheme.color,
                          border: on ? null : Border.all(color: theme.colorScheme.outlineVariant),
                        ),
                        child: Text('$emoji  ${_categoryTitle(l, id)}',
                            style: theme.textTheme.labelLarge?.copyWith(
                              color: on ? Colors.white : theme.colorScheme.onSurface,
                              fontWeight: on ? FontWeight.w800 : FontWeight.w600,
                            )),
                      ),
                    );
                  },
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              sliver: SliverGrid.builder(
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 220,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  mainAxisExtent: 178,
                ),
                itemCount: inCategory.length,
                itemBuilder: (_, i) {
                  final item = inCategory[i];
                  return _StoreCard(
                    item: item,
                    equipped: equipped == item.id,
                    busy: _busy == item.id,
                    onBuy: () => _buy(item),
                    onEquip: (on) => _equip(item, on: on),
                  );
                },
              ),
            ),
          ]);
        },
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.ownedCount, required this.total});
  final int ownedCount;
  final int total;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 4),
      padding: const EdgeInsets.fromLTRB(16, 12, 14, 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFFF4D6D), Color(0xFFFF8A5B), Color(0xFFF5A524)]),
        boxShadow: [BoxShadow(color: Brand.coral.withValues(alpha: 0.26), blurRadius: 16, offset: const Offset(0, 6))],
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(l.storeHeroTitle, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16, height: 1.15)),
            const SizedBox(height: 3),
            Text(l.storeIntro, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.white.withValues(alpha: 0.92), fontSize: 12, height: 1.25)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: ShapeDecoration(shape: const StadiumBorder(), color: Colors.white.withValues(alpha: 0.22)),
              child: Text(l.storeCollected(ownedCount, total), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 11)),
            ),
          ]),
        ),
        const SizedBox(width: 8),
        const Text('🛍️', style: TextStyle(fontSize: 40)),
      ]),
    );
  }
}

class _StoreCard extends StatelessWidget {
  const _StoreCard({required this.item, required this.equipped, required this.busy, required this.onBuy, required this.onEquip});
  final StoreItem item;
  final bool equipped;
  final bool busy;
  final VoidCallback onBuy;
  final ValueChanged<bool> onEquip;

  Widget _preview(BuildContext context) {
    final id = item.id;
    switch (item.category) {
      case 'chatBubble':
        return MiniChatPreview(bubble: storeChatBubbleStyleOf(id));
      case 'chatBackground':
        return MiniChatPreview(backdrop: storeChatBackdropStyleOf(id));
      case 'frame':
        return Center(
          child: Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: storeFrameGradientOf(id))),
            child: CircleAvatar(
              radius: 28,
              backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: Icon(Icons.person_rounded, size: 32, color: Theme.of(context).colorScheme.outline),
            ),
          ),
        );
      case 'badge':
        return Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: ShapeDecoration(shape: const StadiumBorder(), color: Brand.gold.withValues(alpha: 0.14)),
            child: Text('Ayşe  ${storeBadgeEmoji[id] ?? ''}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          ),
        );
      case 'theme':
        final accent = storePremiumThemeAccent[id] ?? Brand.coral;
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [accent, Color.lerp(accent, Colors.black, 0.45)!]),
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 30),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: theme.cardTheme.color,
        borderRadius: BorderRadius.circular(Brand.radius + 2),
        border: Border.all(color: equipped ? Brand.coral : theme.colorScheme.outlineVariant.withValues(alpha: 0.6), width: equipped ? 2 : 1),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 3))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(height: 80, child: _preview(context)),
        const SizedBox(height: 8),
        Text(l.storeItemName(item.id), style: theme.textTheme.labelLarge, maxLines: 1, overflow: TextOverflow.ellipsis),
        const Spacer(),
        if (!item.owned)
          FilledButton.icon(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 38), padding: const EdgeInsets.symmetric(horizontal: 10)),
            onPressed: busy ? null : onBuy,
            icon: busy
                ? const SizedBox.square(dimension: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.monetization_on_rounded, size: 16),
            label: Text('${item.priceCoins}'),
          )
        else if (equipped)
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38), padding: const EdgeInsets.symmetric(horizontal: 10)),
            onPressed: busy ? null : () => onEquip(false),
            icon: const Icon(Icons.check_circle_rounded, size: 16, color: Brand.coral),
            label: Text(l.storeInUse),
          )
        else
          FilledButton.tonal(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 38), padding: const EdgeInsets.symmetric(horizontal: 10)),
            onPressed: busy ? null : () => onEquip(true),
            child: Text(l.storeEquip),
          ),
      ]),
    );
  }
}
