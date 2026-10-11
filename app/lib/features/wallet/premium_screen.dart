import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/config.dart';
import '../../core/fx.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/store.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 16: VibeUpMe+ — RevenueCat üzerinden aylık abonelik (mevcut jeton mağazasıyla aynı
// CoinStore istemcisini paylaşır, sadece ürün kategorisi "subscription"). Tek perk: "seni
// beğenenler" her zaman açık (server/src/routes/boosts.ts). Fiyat mağaza tarafında ayarlanır;
// mağaza bağlı değilse (web/test) dev-subscribe ile test modu.
final _premiumPriceProvider = FutureProvider<String?>((ref) async {
  try {
    final prices = await CoinStore.instance.localPrices([vibeUpMePlusProductId], subscription: true);
    return prices[vibeUpMePlusProductId];
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
        if (!await CoinStore.instance.buy(vibeUpMePlusProductId, subscription: true)) return; // vazgeçti
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
    final perks = ref.watch(_perkStatusProvider).value;
    final premiumUntil = me.value?.premiumUntil;
    final active = premiumUntil != null;

    return Scaffold(
      appBar: AppBar(title: Text(l.premiumTitle)),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        // Altın başlık: VibeUpMe+ premium bir üyelik hissi verir
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: premiumGradient,
            boxShadow: [BoxShadow(color: const Color(0xFFD99A0B).withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8))],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.workspace_premium_rounded, color: Color(0xFF4A3200), size: 34),
            const SizedBox(height: 10),
            Text(l.premiumTitle, style: theme.textTheme.headlineSmall?.copyWith(color: const Color(0xFF4A3200), fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text(l.premiumTagline, style: theme.textTheme.bodyMedium?.copyWith(color: const Color(0xFF4A3200))),
          ]),
        ),
        const SizedBox(height: 16),
        _Perk(icon: Icons.favorite_rounded, title: l.likesYou, subtitle: l.premiumPerkLikes),
        _Perk(
          icon: Icons.star_rounded,
          color: const Color(0xFF2F80ED),
          title: l.superLike,
          subtitle: l.premiumPerkSuperLikes(perks?.premiumDaily ?? 10, perks?.freeDaily ?? 3),
        ),
        _Perk(
          icon: Icons.swipe_rounded,
          title: l.premiumPerkLikeLimitTitle,
          subtitle: l.premiumPerkLikeLimit(perks?.likeLimitPremium ?? 50, perks?.likeLimitFree ?? 25),
        ),
        _Perk(icon: Icons.workspace_premium_rounded, color: const Color(0xFFD99A0B), title: l.premiumBadgeShort, subtitle: l.premiumPerkBadge),
        const SizedBox(height: 8),
        Text(l.premiumMonthlyNote, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
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

final _perkStatusProvider = FutureProvider.autoDispose<SuperLikeStatus>((ref) => ref.watch(apiProvider).superLikeStatus());

class _Perk extends StatelessWidget {
  const _Perk({required this.icon, required this.title, required this.subtitle, this.color});
  final IconData icon;
  final String title;
  final String subtitle;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = color ?? Brand.coral;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        dense: true,
        leading: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(shape: BoxShape.circle, color: c.withValues(alpha: 0.14)),
          child: Icon(icon, color: c, size: 20),
        ),
        title: Text(title, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
        subtitle: Text(subtitle),
      ),
    );
  }
}
