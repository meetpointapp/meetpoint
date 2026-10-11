import 'package:flutter/material.dart';

import '../../core/models.dart';
import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';

// Faz 20: süper beğeni paketleri. Paket büyüdükçe adet fiyatı düşer; en ucuz birim "En avantajlı" etiketi
// alır. Hem keşfette hak bitince açılan sayfada hem mağazanın "Süper beğeni" bölümünde kullanılır.
class SuperLikePackTiles extends StatelessWidget {
  const SuperLikePackTiles({super.key, required this.status, required this.busyId, required this.onBuy});
  final SuperLikeStatus status;
  final String? busyId;
  final ValueChanged<SuperLikePack> onBuy;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final best = status.packs.isEmpty ? null : status.packs.reduce((a, b) => a.unitPrice <= b.unitPrice ? a : b).id;
    return Column(children: [
      for (final p in status.packs)
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
          decoration: BoxDecoration(
            color: theme.cardTheme.color,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: p.id == best ? Brand.coral : theme.colorScheme.outlineVariant.withValues(alpha: 0.6), width: p.id == best ? 2 : 1),
          ),
          child: Row(children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x1F2F80ED)),
              child: const Icon(Icons.star_rounded, color: Color(0xFF2F80ED)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(l.superLikePackCount(p.count), style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
                  if (p.id == best) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: ShapeDecoration(shape: const StadiumBorder(), color: Brand.coral),
                      child: Text(l.superLikeBestValue, style: TextStyle(color: Brand.onAccent, fontSize: 10.5, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ]),
                Text(l.superLikeUnit(p.unitPrice.toStringAsFixed(p.unitPrice == p.unitPrice.roundToDouble() ? 0 : 1)),
                    style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              ]),
            ),
            FilledButton.icon(
              style: FilledButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 14)),
              onPressed: busyId != null ? null : () => onBuy(p),
              icon: busyId == p.id
                  ? SizedBox.square(dimension: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Brand.onAccent))
                  : const Icon(Icons.monetization_on_rounded, size: 16),
              label: Text('${p.price}'),
            ),
          ]),
        ),
    ]);
  }
}
