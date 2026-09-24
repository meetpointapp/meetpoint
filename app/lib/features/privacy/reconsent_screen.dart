import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Kullanım koşulları veya aydınlatma metni değişti: yeni sürüm onaylanmadan uygulama kullanılamaz.
// Onay vermek istemeyen verilerini indirebilir ya da hesabını silebilir (Gizlilik ve verilerim).
class ReconsentScreen extends ConsumerStatefulWidget {
  const ReconsentScreen({super.key});

  @override
  ConsumerState<ReconsentScreen> createState() => _ReconsentScreenState();
}

class _ReconsentScreenState extends ConsumerState<ReconsentScreen> {
  bool _busy = false;

  Future<void> _accept() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).acceptLegal();
      ref.invalidate(meProvider);
      ref.read(sessionProvider.notifier).legalAccepted();
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
    final locale = ref.watch(localeProvider).languageCode;
    final updates = ref.watch(meProvider).value?.legalUpdates ?? const ['terms', 'privacy'];
    return Scaffold(
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(24, 48, 24, 24), children: [
          const Icon(Icons.article_outlined, size: 56, color: Brand.coral),
          const SizedBox(height: 16),
          Text(l.reconsentTitle, textAlign: TextAlign.center, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(l.reconsentBody, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
          const SizedBox(height: 16),
          Card(
            child: Column(children: [
              for (final doc in updates)
                ListTile(
                  leading: const Icon(Icons.description_outlined),
                  title: Text(doc == 'terms' ? l.termsOfService : l.privacyPolicy),
                  trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                  onTap: () => openLegal(doc, locale),
                ),
            ]),
          ),
          const SizedBox(height: 24),
          GradientButton(label: l.reconsentAccept, busy: _busy, onPressed: _accept),
          const SizedBox(height: 8),
          TextButton(onPressed: () => context.push('/me/privacy'), child: Text(l.privacyAndData)),
          TextButton(onPressed: () => ref.read(sessionProvider.notifier).logout(), child: Text(l.logout)),
        ]),
      ),
    );
  }
}
