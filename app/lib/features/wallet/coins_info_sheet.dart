import 'package:flutter/material.dart';

import '../../core/models.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// "Jetonlar nasıl çalışır?": istek ücretleri, arama ücretleri ve kazanç/olgunlaşma tek yerde,
// cüzdan ekranındaki bilgi simgesinden her zaman açılabilir (Faz 16: ilk kullanım rehberi).
Future<void> showCoinsInfo(BuildContext context, WalletInfo wallet) {
  final l = AppLocalizations.of(context);
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.92,
      builder: (_, scrollCtrl) => SafeArea(
        child: ListView(
          controller: scrollCtrl,
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          children: [
            Text(l.coinsInfoTitle, style: Theme.of(ctx).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            Text(l.coinsInfoRequestsTitle, style: Theme.of(ctx).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final k in RequestKind.values)
              if (wallet.requestPrices[k] != null) _InfoRow(icon: requestKindIcon(k), label: requestKindLabel(l, k), value: l.coins(wallet.requestPrices[k]!)),
            const SizedBox(height: 20),
            Text(l.coinsInfoCallsTitle, style: Theme.of(ctx).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(l.coinsInfoCallsBody, style: Theme.of(ctx).textTheme.bodySmall?.copyWith(color: Theme.of(ctx).colorScheme.onSurfaceVariant)),
            const SizedBox(height: 8),
            for (final k in CallKind.values)
              if (wallet.callRates[k] != null) _InfoRow(icon: k == CallKind.video ? Icons.videocam_rounded : Icons.call_rounded, label: callKindLabelFor(l, k), value: l.perMinute(wallet.callRates[k]!)),
            const SizedBox(height: 20),
            Text(l.coinsInfoEarnTitle, style: Theme.of(ctx).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(l.coinsInfoEarnBody(wallet.cashout.maturityDays)),
            const SizedBox(height: 12),
            Text(l.coinsInfoPromoBody, style: Theme.of(ctx).textTheme.bodySmall?.copyWith(color: Theme.of(ctx).colorScheme.onSurfaceVariant)),
          ],
        ),
      ),
    ),
  );
}

String callKindLabelFor(AppLocalizations l, CallKind k) => k == CallKind.video ? l.videoCall : l.voiceCall;

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          Icon(icon, size: 20, color: Brand.coral),
          const SizedBox(width: 12),
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ]),
      );
}
