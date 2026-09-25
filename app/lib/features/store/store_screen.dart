import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/catalog.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 16: kozmetik mağaza. Jetonla alınan çerçeve, rozet, premium tema, oda mobilyası, avatar
// kıyafeti ve sohbet teması — kullanıcıdan kullanıcıya geçmez, tamamı platform geliri. Satın
// alındıktan sonra ilgili düzenleyicide (Vitrin/Avatar/Oda) seçilebilir hale gelir.
class StoreScreen extends ConsumerStatefulWidget {
  const StoreScreen({super.key});

  @override
  ConsumerState<StoreScreen> createState() => _StoreScreenState();
}

class _StoreScreenState extends ConsumerState<StoreScreen> {
  String? _buying;

  Future<void> _buy(StoreItem item) async {
    final l = AppLocalizations.of(context);
    setState(() => _buying = item.id);
    try {
      await ref.read(apiProvider).purchaseItem(item.id);
      ref.invalidate(storeItemsProvider);
      ref.invalidate(walletProvider);
      if (mounted) showSnack(context, l.storePurchased);
    } catch (e) {
      if (!mounted) return;
      final low = e is ApiException && e.code == 'insufficient_balance';
      showSnack(context, errorText(l, e), action: low ? SnackBarAction(label: l.topUp, onPressed: () => context.go('/wallet')) : null);
    } finally {
      if (mounted) setState(() => _buying = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final items = ref.watch(storeItemsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.storeTitle)),
      body: items.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(storeItemsProvider)),
        data: (list) {
          final byCategory = <String, List<StoreItem>>{};
          for (final i in list) {
            byCategory.putIfAbsent(i.category, () => []).add(i);
          }
          const order = ['frame', 'badge', 'theme', 'roomItem', 'avatarOutfit', 'chatBubble', 'chatBackground'];
          return ListView(padding: const EdgeInsets.all(16), children: [
            Text(l.storeIntro, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
            const SizedBox(height: 20),
            for (final category in order)
              if (byCategory[category]?.isNotEmpty ?? false) ...[
                Text(_categoryTitle(l, category), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 10),
                Wrap(spacing: 10, runSpacing: 10, children: [
                  for (final item in byCategory[category]!)
                    _StoreCard(item: item, busy: _buying == item.id, onBuy: () => _buy(item)),
                ]),
                const SizedBox(height: 24),
              ],
          ]);
        },
      ),
    );
  }

  String _categoryTitle(AppLocalizations l, String category) => switch (category) {
        'frame' => l.storeCategoryFrame,
        'badge' => l.storeCategoryBadge,
        'theme' => l.storeCategoryTheme,
        'roomItem' => l.storeCategoryRoomItem,
        'avatarOutfit' => l.storeCategoryAvatarOutfit,
        'chatBubble' => l.storeCategoryChatBubble,
        'chatBackground' => l.storeCategoryChatBackground,
        _ => category,
      };
}

class _StoreCard extends StatelessWidget {
  const _StoreCard({required this.item, required this.busy, required this.onBuy});
  final StoreItem item;
  final bool busy;
  final VoidCallback onBuy;

  Widget _preview() {
    final id = item.id;
    switch (item.category) {
      case 'frame':
        return DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: storeFrameGradientOf(id))));
      case 'badge':
        return Center(child: Text(storeBadgeEmoji[id] ?? '', style: const TextStyle(fontSize: 26)));
      case 'theme':
        return DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, color: storePremiumThemeAccent[id]));
      case 'roomItem':
        return Center(child: Text(storeRoomItemEmoji[id] ?? '', style: const TextStyle(fontSize: 26)));
      case 'avatarOutfit':
        return DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, color: storeAvatarOutfitColor[id]));
      case 'chatBubble':
        return DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, color: storeChatBubbleColor[id]));
      case 'chatBackground':
        return DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, color: storeChatBackgroundColor[id]));
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Container(
      width: 148,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(Brand.radius),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 40, height: 40, child: _preview()),
        const SizedBox(height: 10),
        Text(l.storeItemName(item.id), style: theme.textTheme.labelLarge, maxLines: 2, overflow: TextOverflow.ellipsis),
        const SizedBox(height: 10),
        if (item.owned)
          Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.check_circle_rounded, size: 16, color: theme.colorScheme.primary),
            const SizedBox(width: 4),
            Text(l.storeOwned, style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.primary)),
          ])
        else
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: busy ? null : onBuy,
              child: busy
                  ? const SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(l.coins(item.priceCoins)),
            ),
          ),
      ]),
    );
  }
}
