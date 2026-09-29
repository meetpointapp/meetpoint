import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/config.dart';
import '../../core/fx.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/store.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 16: MeetPoint+ — RevenueCat üzerinden aylık abonelik (mevcut jeton mağazasıyla aynı
// CoinStore istemcisini paylaşır, sadece ürün kategorisi "subscription"). Tek perk: "seni
// beğenenler" her zaman açık (server/src/routes/boosts.ts). Fiyat mağaza tarafında ayarlanır;
// mağaza bağlı değilse (web/test) dev-subscribe ile test modu.
final _premiumPriceProvider = FutureProvider<String?>((ref) async {
  try {
    final prices = await CoinStore.instance.localPrices([meetPointPlusProductId], subscription: true);
    return prices[meetPointPlusProductId];
  } catch (_) {
    return null;
  }
});

class PremiumScreen extends ConsumerStatefulWidget {
  const PremiumScreen({super.key});

  @override
  ConsumerState<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends ConsumerState<PremiumScreen> {
  bool _busy = false;

  Future<void> _subscribe() async {
    final l = AppLocalizations.of(context);
    final api = ref.read(apiProvider);
    setState(() => _busy = true);
    try {
      if (CoinStore.instance.available) {
        if (!await CoinStore.instance.buy(meetPointPlusProductId, subscription: true)) return; // vazgeçti
        if (mounted) showSnack(context, l.paymentProcessing);
        // Webhook gecikebilir: sunucu RevenueCat'ten abonelik durumunu çekip yükler
        for (var i = 0; i < 3; i++) {
          await api.syncWallet();
          ref.invalidate(meProvider);
          if ((await ref.read(meProvider.future)).premiumUntil != null) break;
          await Future<void>.delayed(const Duration(seconds: 2));
        }
      } else {
        await api.devSubscribe();
      }
      ref.invalidate(meProvider);
      final subscribed = (await ref.read(meProvider.future)).premiumUntil != null;
      // "Seni beğenenler" abonelikle her zaman açık olur — önbellekteki kilitli sonuç güncellenmeli
      if (subscribed) {
        ref.invalidate(likesProvider);
        Fx.success();
      }
      if (mounted && subscribed) showSnack(context, l.premiumSubscribed);
    } on StoreUnavailable {
      if (mounted) showSnack(context, l.errStoreUnavailable);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final me = ref.watch(meProvider);
    final priceText = ref.watch(_premiumPriceProvider).value;
    final premiumUntil = me.value?.premiumUntil;
    final active = premiumUntil != null;

    return Scaffold(
      appBar: AppBar(title: Text(l.premiumTitle)),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(Brand.radius), gradient: Brand.gradient),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 28),
            const SizedBox(height: 12),
            Text(l.premiumTitle, style: theme.textTheme.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(l.premiumTagline, style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white)),
          ]),
        ),
        const SizedBox(height: 20),
        Card(
          child: ListTile(
            leading: const Icon(Icons.favorite_rounded, color: Brand.coral),
            title: Text(l.likesYou),
            subtitle: Text(l.premiumPerkLikes),
          ),
        ),
        const SizedBox(height: 24),
        if (active) ...[
          Row(children: [
            Icon(Icons.check_circle_rounded, color: theme.colorScheme.primary),
            const SizedBox(width: 8),
            Expanded(child: Text(l.premiumActive, style: theme.textTheme.titleMedium)),
          ]),
          const SizedBox(height: 6),
          Text(l.premiumActiveUntil(DateFormat.yMMMd(l.localeName).format(premiumUntil)),
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: () => launchSubscriptionManagement(),
            child: Text(l.premiumManage),
          ),
        ] else ...[
          if (!CoinStore.instance.available) ...[
            Text(l.testModeNote, style: theme.textTheme.bodySmall),
            const SizedBox(height: 8),
          ],
          GradientButton(
            icon: Icons.auto_awesome_rounded,
            label: priceText == null ? l.premiumSubscribe : l.premiumPriceMonthly(priceText),
            busy: _busy,
            onPressed: _subscribe,
          ),
        ],
      ]),
    );
  }
}
