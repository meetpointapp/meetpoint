import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/config.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 17 madde 8: davet programı ("Arkadaşını davet et, ikiniz de ödül kazanın"). Kendi kodu ve
// paylaşma burada, stats ise ayrı (ağır) bir uçtan — journey/weeklyDigest ile aynı yaklaşım.
final referralStatsProvider = FutureProvider.autoDispose<ReferralStats>(
  (ref) => ref.watch(apiProvider).referralStats(),
);

class ReferralScreen extends ConsumerWidget {
  const ReferralScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final code = ref.watch(meProvider).value?.referralCode;
    final stats = ref.watch(referralStatsProvider).value;

    return Scaffold(
      appBar: AppBar(title: Text(l.referralTitle)),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(20), children: [
          Icon(Icons.card_giftcard_rounded, size: 48, color: Brand.coral),
          const SizedBox(height: 12),
          Text(l.referralExplain, style: theme.textTheme.bodyLarge),
          const SizedBox(height: 24),
          if (code != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(l.referralYourCode, style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 6),
                  Center(
                    child: Text(code, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: 3)),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: GradientButton(
                      label: l.referralCopyCode,
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: code));
                        if (context.mounted) showSnack(context, l.referralCodeCopied);
                      },
                    ),
                  ),
                ]),
              ),
            ),
          const SizedBox(height: 20),
          if (code != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Icon(Icons.link_rounded, size: 20, color: Brand.coral),
                    const SizedBox(width: 10),
                    Expanded(child: Text(l.personalLinkTitle, style: theme.textTheme.titleSmall)),
                  ]),
                  const SizedBox(height: 6),
                  Text(l.personalLinkHint, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 10),
                  Text('$apiBaseUrl/u/$code', style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          await Clipboard.setData(ClipboardData(text: '$apiBaseUrl/u/$code'));
                          if (context.mounted) showSnack(context, l.referralCodeCopied);
                        },
                        child: Text(l.referralCopyCode),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => SharePlus.instance.share(ShareParams(text: '$apiBaseUrl/u/$code')),
                        child: Text(l.shareButton),
                      ),
                    ),
                  ]),
                ]),
              ),
            ),
          const SizedBox(height: 20),
          if (stats != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Icon(Icons.group_rounded, size: 20, color: Brand.coral),
                    const SizedBox(width: 10),
                    Expanded(child: Text(l.referralTotalReferred(stats.totalReferred), style: theme.textTheme.bodyMedium)),
                  ]),
                  const SizedBox(height: 10),
                  Row(children: [
                    const Icon(Icons.savings_rounded, size: 20, color: Brand.coral),
                    const SizedBox(width: 10),
                    Expanded(child: Text(l.referralTotalEarned(stats.totalEarnedCoins), style: theme.textTheme.bodyMedium)),
                  ]),
                ]),
              ),
            ),
        ]),
      ),
    );
  }
}
