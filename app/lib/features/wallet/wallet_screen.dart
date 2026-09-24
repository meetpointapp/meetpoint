import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/store.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Mağazanın yerel fiyatları (mağaza bağlı değilse boş: referans USD gösterilir)
final localPricesProvider = FutureProvider<Map<String, String>>((ref) async {
  final packs = (await ref.watch(walletProvider.future)).packs;
  try {
    return await CoinStore.instance.localPrices([for (final p in packs) p.id]);
  } catch (_) {
    return {};
  }
});

class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  String? _buying; // satın alınmakta olan paket

  Future<void> _buy(CoinPack pack) async {
    final l = AppLocalizations.of(context);
    final api = ref.read(apiProvider);
    final before = ref.read(walletProvider).value?.balance ?? 0;
    setState(() => _buying = pack.id);
    try {
      if (CoinStore.instance.available) {
        if (!await CoinStore.instance.buy(pack.id)) return; // vazgeçti
        if (mounted) showSnack(context, l.paymentProcessing);
        // Webhook gecikebilir: sunucu RevenueCat'ten eksik işlemleri çekip yükler
        for (var i = 0; i < 3; i++) {
          if (await api.syncWallet() > 0) break;
          await Future<void>.delayed(const Duration(seconds: 2));
        }
      } else {
        await api.devTopUp(pack.id);
      }
      ref.invalidate(walletProvider);
      ref.invalidate(meProvider);
      final after = (await ref.read(walletProvider.future)).balance;
      if (mounted && after > before) showSnack(context, l.purchaseDone(after - before));
    } on StoreUnavailable {
      if (mounted) showSnack(context, l.errStoreUnavailable);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _buying = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final wallet = ref.watch(walletProvider);
    final prices = ref.watch(localPricesProvider).value ?? const {};

    return Scaffold(
      appBar: AppBar(title: Text(l.navWallet)),
      body: wallet.when(
        loading: () => const ListSkeleton(rows: 5),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(walletProvider)),
        data: (w) {
          final bonusPct = w.firstPurchaseBonusPct;
          return RefreshIndicator(
            onRefresh: () => ref.refresh(walletProvider.future),
            child: ListView(padding: const EdgeInsets.all(16), children: [
              _BalanceCard(wallet: w),
              const SizedBox(height: 24),
              Text(l.buyCoins, style: theme.textTheme.titleMedium),
              if (!CoinStore.instance.available) ...[
                const SizedBox(height: 4),
                Text(l.testModeNote, style: theme.textTheme.bodySmall),
              ],
              if (bonusPct > 0) ...[
                const SizedBox(height: 12),
                _BonusBanner(pct: bonusPct),
              ],
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.35,
                children: [
                  for (final p in w.packs)
                    _PackTile(
                      pack: p,
                      price: prices[p.id] ?? '\$${p.usd.toStringAsFixed(2)}',
                      bonus: bonusPct > 0 ? (p.coins * bonusPct / 100).round() : 0,
                      busy: _buying == p.id,
                      onTap: _buying == null ? () => _buy(p) : null,
                    ),
                ],
              ),
              const SizedBox(height: 24),
              Text(l.history, style: theme.textTheme.titleMedium),
              if (w.entries.isEmpty)
                Padding(padding: const EdgeInsets.symmetric(vertical: 24), child: Center(child: Text(l.noHistory)))
              else
                for (final e in w.entries) _EntryTile(entry: e),
            ]),
          );
        },
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.wallet});
  final WalletInfo wallet;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    const onCard = Colors.white;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), gradient: Brand.gradient),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(l.balance, style: theme.textTheme.titleSmall?.copyWith(color: onCard)),
        const SizedBox(height: 4),
        CoinAmount(wallet.balance,
            style: theme.textTheme.displaySmall?.copyWith(color: onCard, fontWeight: FontWeight.w800)),
        const Divider(color: Colors.white38, height: 28),
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(l.cashable, style: theme.textTheme.labelLarge?.copyWith(color: onCard)),
              Text(
                '${l.coins(wallet.cashable)} ≈ \$${wallet.cashableUsd.toStringAsFixed(2)}',
                style: theme.textTheme.titleMedium?.copyWith(color: onCard, fontWeight: FontWeight.w700),
              ),
              Text(l.cashableInfo, style: theme.textTheme.bodySmall?.copyWith(color: Colors.white70)),
              // Olgunlaşan kazanç: iade süresi dolunca bozdurulabilir
              if (wallet.maturingEarnings > 0 && wallet.nextMatureAt != null) ...[
                const SizedBox(height: 6),
                Text(l.maturingEarnings(wallet.maturingEarnings, DateFormat.MMMd(l.localeName).format(wallet.nextMatureAt!)),
                    style: theme.textTheme.bodySmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
              ],
              if (wallet.promoEarnings > 0) ...[
                const SizedBox(height: 6),
                Tooltip(
                  message: l.promoEarningsInfo,
                  triggerMode: TooltipTriggerMode.tap,
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Flexible(
                      child: Text(l.promoEarnings(wallet.promoEarnings),
                          style: theme.textTheme.bodySmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.info_outline_rounded, size: 14, color: Colors.white70),
                  ]),
                ),
              ],
            ]),
          ),
          const SizedBox(width: 12),
          FilledButton.tonal(
            onPressed: () => context.push('/wallet/cashout'),
            style: FilledButton.styleFrom(
              backgroundColor: Colors.white.withValues(alpha: 0.22),
              foregroundColor: Colors.white,
            ),
            child: Text(l.cashout),
          ),
        ]),
      ]),
    );
  }
}

class _BonusBanner extends StatelessWidget {
  const _BonusBanner({required this.pct});
  final int pct;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(Brand.radius),
          color: Brand.gold.withValues(alpha: 0.14),
          border: Border.all(color: Brand.gold.withValues(alpha: 0.6)),
        ),
        child: Row(children: [
          const Text('🎁', style: TextStyle(fontSize: 20)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(AppLocalizations.of(context).firstPurchaseBanner(pct),
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
          ),
        ]),
      );
}

class _PackTile extends StatelessWidget {
  const _PackTile({required this.pack, required this.price, required this.bonus, required this.busy, required this.onTap});
  final CoinPack pack;
  final String price;
  final int bonus;
  final bool busy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final card = Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Brand.radius),
        side: pack.popular ? const BorderSide(color: Brand.coral, width: 2) : BorderSide.none,
      ),
      child: InkWell(
        onTap: onTap,
        child: Center(
          child: busy
              ? const CircularProgressIndicator()
              : Column(mainAxisSize: MainAxisSize.min, children: [
                  CoinAmount(pack.coins, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                  if (bonus > 0)
                    Text(l.bonusCoins(bonus),
                        style: theme.textTheme.labelMedium?.copyWith(color: const Color(0xFF1FA463), fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(price, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                ]),
        ),
      ),
    );
    // Ekran okuyucu: "1000 jeton · +500 bonus · $19.99"
    final label = [l.coins(pack.coins), if (bonus > 0) l.bonusCoins(bonus), price].join(' · ');
    final semantic = Semantics(button: true, label: label, excludeSemantics: true, onTap: onTap, child: card);
    if (!pack.popular) return semantic;
    return Stack(clipBehavior: Clip.none, children: [
      Positioned.fill(child: semantic),
      Positioned(
        top: -8,
        left: 0,
        right: 0,
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
            decoration: const ShapeDecoration(shape: StadiumBorder(), gradient: Brand.gradient),
            child: Text(l.mostPopular,
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
          ),
        ),
      ),
    ]);
  }
}

class _EntryTile extends StatelessWidget {
  const _EntryTile({required this.entry});
  final WalletEntry entry;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final label = switch (entry.type) {
      'PURCHASE' => l.txPurchase,
      'BONUS' => l.txBonus,
      'HOLD' => l.txHold,
      'REFUND' => l.txRefund,
      'EARN' => l.txEarn,
      'SPEND' => l.txSpend,
      'CALL' => l.txCall,
      'GIFT' => l.txGift,
      'CASHOUT' => l.txCashout,
      'CASHOUT_REFUND' => l.txCashoutRefund,
      'CLAWBACK' => l.txClawback,
      _ => l.txGrant,
    };
    final positive = entry.amount > 0;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(DateFormat.yMMMd(l.localeName).add_Hm().format(entry.createdAt)),
      trailing: CoinAmount(
        entry.amount,
        signed: true,
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: positive ? const Color(0xFF1FA463) : Theme.of(context).colorScheme.error,
        ),
      ),
    );
  }
}
