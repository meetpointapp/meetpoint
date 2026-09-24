import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/formatters.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import 'kyc_card.dart';

// Kazanılan jetonları paraya çevirme: talep oluştur (IBAN/PayPal), incelenen talebi iptal et,
// geçmiş talepleri gör. Ödeme yönetim panelinden elle yapılır.
class CashoutScreen extends ConsumerStatefulWidget {
  const CashoutScreen({super.key});

  @override
  ConsumerState<CashoutScreen> createState() => _CashoutScreenState();
}

class _CashoutScreenState extends ConsumerState<CashoutScreen> {
  @override
  void initState() {
    super.initState();
    // Mavi tik onayı veya ödeme sonucu başka yerde gerçekleşmiş olabilir: açılışta tazele
    Future.microtask(() {
      ref.invalidate(meProvider);
      ref.invalidate(walletProvider);
      ref.invalidate(payoutsProvider);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final wallet = ref.watch(walletProvider);
    final me = ref.watch(meProvider).value;
    final payouts = ref.watch(payoutsProvider).value ?? const <Payout>[];

    return Scaffold(
      appBar: AppBar(title: Text(l.cashout)),
      body: wallet.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(walletProvider)),
        data: (w) {
          final rules = w.cashout;
          final verified = me?.verificationStatus == 'approved';
          final pending = rules.pending;
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(payoutsProvider);
              ref.invalidate(meProvider);
              ref.invalidate(walletProvider);
              await ref.read(walletProvider.future);
            },
            child: ListView(padding: const EdgeInsets.all(16), children: [
              _AvailableCard(wallet: w),
              const SizedBox(height: 16),
              if (pending != null)
                _PendingCard(payout: pending)
              else if (!verified)
                _Notice(
                  icon: Icons.verified_user_outlined,
                  text: l.cashoutNeedVerify,
                  action: FilledButton(onPressed: () => context.push('/verify-profile'), child: Text(l.verifyProfile)),
                )
              else if (rules.kycStatus != 'approved')
                // Kimlik doğrulaması: para çekmek için zorunlu (ad-soyad, TC, belge)
                const KycCard()
              else if (w.cashable < rules.minCoins)
                _Notice(
                  icon: Icons.savings_outlined,
                  text: w.maturingEarnings > 0 ? '${l.cashoutNotEnough(rules.minCoins)}\n${l.maturingInfo(rules.maturityDays)}' : l.cashoutNotEnough(rules.minCoins),
                )
              else
                _CashoutForm(wallet: w),
              const SizedBox(height: 12),
              Center(
                child: TextButton.icon(
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: Text(l.earningsStatement),
                  onPressed: () => showEarningsStatement(context, ref),
                ),
              ),
              if (payouts.any((p) => p.status != PayoutStatus.pending)) ...[
                const SizedBox(height: 24),
                Text(l.payoutHistory, style: Theme.of(context).textTheme.titleMedium),
                for (final p in payouts.where((p) => p.status != PayoutStatus.pending)) _PayoutTile(payout: p),
              ],
            ]),
          );
        },
      ),
    );
  }
}

class _AvailableCard extends StatelessWidget {
  const _AvailableCard({required this.wallet});
  final WalletInfo wallet;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final rules = wallet.cashout;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), gradient: Brand.gradient),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(l.cashoutAvailable, style: theme.textTheme.titleSmall?.copyWith(color: Colors.white)),
        const SizedBox(height: 4),
        Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
          Text(rules.usdOf(wallet.cashable),
              style: theme.textTheme.displaySmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
          const SizedBox(width: 10),
          CoinAmount(wallet.cashable, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 8),
        Text(l.cashoutMinInfo(rules.minCoins, rules.usdOf(rules.minCoins)),
            style: theme.textTheme.bodySmall?.copyWith(color: Colors.white70)),
        if (wallet.promoEarnings > 0) ...[
          const SizedBox(height: 10),
          Text(l.promoEarnings(wallet.promoEarnings),
              style: theme.textTheme.bodySmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
          Text(l.promoEarningsInfo, style: theme.textTheme.bodySmall?.copyWith(color: Colors.white70)),
        ],
      ]),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.text, this.action});
  final IconData icon;
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: Brand.coral),
            const SizedBox(width: 12),
            Expanded(child: Text(text, style: theme.textTheme.bodyMedium)),
          ]),
          if (action != null) ...[const SizedBox(height: 12), Align(alignment: Alignment.centerRight, child: action)],
        ]),
      ),
    );
  }
}

class _PendingCard extends ConsumerStatefulWidget {
  const _PendingCard({required this.payout});
  final Payout payout;

  @override
  ConsumerState<_PendingCard> createState() => _PendingCardState();
}

class _PendingCardState extends ConsumerState<_PendingCard> {
  bool _busy = false;

  Future<void> _cancel() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).cancelPayout(widget.payout.id);
      ref.invalidate(walletProvider);
      ref.invalidate(payoutsProvider);
      if (mounted) showSnack(context, l.payoutCancelled);
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
    final p = widget.payout;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('\$${p.usd.toStringAsFixed(2)}', style: theme.textTheme.headlineSmall),
            const SizedBox(width: 10),
            _StatusChip(status: p.status),
          ]),
          const SizedBox(height: 6),
          Text('${p.method == PayoutMethod.iban ? 'IBAN' : 'PayPal'} ${p.accountHint} · ${l.coins(p.coins)}',
              style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 10),
          Text(l.cashoutProcessingInfo, style: theme.textTheme.bodySmall),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(onPressed: _busy ? null : _cancel, child: Text(l.payoutCancel)),
          ),
        ]),
      ),
    );
  }
}

class _CashoutForm extends ConsumerStatefulWidget {
  const _CashoutForm({required this.wallet});
  final WalletInfo wallet;

  @override
  ConsumerState<_CashoutForm> createState() => _CashoutFormState();
}

class _CashoutFormState extends ConsumerState<_CashoutForm> {
  static const _step = 100;
  late int _coins = _max; // varsayılan: çekilebilir tutarın tamamı (100'e yuvarlanmış)
  PayoutMethod _method = PayoutMethod.iban;
  final _name = TextEditingController();
  final _account = TextEditingController();
  bool _busy = false;

  int get _min => widget.wallet.cashout.minCoins;
  int get _max => widget.wallet.cashable ~/ _step * _step;

  @override
  void dispose() {
    _name.dispose();
    _account.dispose();
    super.dispose();
  }

  bool get _valid {
    final account = _account.text.trim();
    if (_method == PayoutMethod.paypal) return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(account);
    return _name.text.trim().length >= 3 && account.replaceAll(' ', '').length >= 15;
  }

  Future<void> _submit() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).requestPayout(
            coins: _coins,
            method: _method,
            accountName: _name.text.trim(),
            accountValue: _account.text.trim(),
          );
      ref.invalidate(walletProvider);
      ref.invalidate(payoutsProvider);
      if (mounted) showSnack(context, l.cashoutRequested);
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
    final rules = widget.wallet.cashout;
    final divisions = (_max - _min) ~/ _step;

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(l.cashoutAmount, style: theme.textTheme.titleMedium),
      const SizedBox(height: 4),
      Row(children: [
        Text(rules.usdOf(_coins), style: theme.textTheme.headlineSmall),
        const SizedBox(width: 10),
        CoinAmount(_coins, style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
      ]),
      if (divisions > 0)
        Slider(
          value: _coins.toDouble(),
          min: _min.toDouble(),
          max: _max.toDouble(),
          divisions: divisions,
          label: rules.usdOf(_coins),
          onChanged: (v) => setState(() => _coins = v.round()),
        ),
      const SizedBox(height: 12),
      Text(l.cashoutMethod, style: theme.textTheme.titleMedium),
      const SizedBox(height: 8),
      SegmentedButton<PayoutMethod>(
        segments: [
          const ButtonSegment(value: PayoutMethod.iban, label: Text('IBAN'), icon: Icon(Icons.account_balance_rounded)),
          ButtonSegment(value: PayoutMethod.paypal, label: const Text('PayPal'), icon: const Icon(Icons.alternate_email_rounded)),
        ],
        selected: {_method},
        onSelectionChanged: (s) => setState(() {
          _method = s.first;
          _account.clear();
        }),
      ),
      const SizedBox(height: 16),
      if (_method == PayoutMethod.iban) ...[
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          decoration: InputDecoration(labelText: l.accountHolder, helperText: l.accountHolderMustMatch),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _account,
          textCapitalization: TextCapitalization.characters,
          inputFormatters: [IbanInputFormatter()],
          decoration: const InputDecoration(labelText: 'IBAN', hintText: 'TR00 0000 0000 0000 0000 0000 00'),
          onChanged: (_) => setState(() {}),
        ),
      ] else
        TextField(
          controller: _account,
          keyboardType: TextInputType.emailAddress,
          decoration: InputDecoration(labelText: l.paypalEmail),
          onChanged: (_) => setState(() {}),
        ),
      if (rules.withholdingRate > 0) ...[
        const SizedBox(height: 12),
        Text(l.cashoutNetAfterTax(rules.netUsdOf(_coins), (rules.withholdingRate * 100).toStringAsFixed(0)),
            style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
      ],
      const SizedBox(height: 12),
      Text(l.cashoutProcessingInfo,
          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
      const SizedBox(height: 16),
      GradientButton(
        label: l.cashoutSubmit(rules.usdOf(_coins)),
        icon: Icons.payments_rounded,
        onPressed: _valid && !_busy ? _submit : null,
      ),
    ]);
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final PayoutStatus status;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final (String label, Color color) = switch (status) {
      PayoutStatus.pending => (l.payoutStatusPending, Brand.gold),
      PayoutStatus.paid => (l.payoutStatusPaid, const Color(0xFF1FA463)),
      PayoutStatus.rejected => (l.payoutStatusRejected, Theme.of(context).colorScheme.error),
      PayoutStatus.cancelled => (l.payoutStatusCancelled, Theme.of(context).colorScheme.outline),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}

class _PayoutTile extends StatelessWidget {
  const _PayoutTile({required this.payout});
  final Payout payout;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = payout;
    final details = [
      '${p.method == PayoutMethod.iban ? 'IBAN' : 'PayPal'} ${p.accountHint}',
      DateFormat.yMMMd(l.localeName).format(p.createdAt),
      if (p.reference.isNotEmpty) l.payoutReference(p.reference),
      if (p.adminNote.isNotEmpty) l.payoutReason(p.adminNote),
    ];
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text('\$${p.usd.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text(details.join(' · ')),
      trailing: _StatusChip(status: p.status),
    );
  }
}
