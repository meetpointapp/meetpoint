import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Açık rıza kutucuğu: kısa açıklama + "Metni oku" bağlantısı. Varsayılan işaretsiz (KVKK: rıza
// önceden işaretlenemez, başka onaylara bağlanamaz).
class ConsentCheckbox extends ConsumerWidget {
  const ConsentCheckbox({super.key, required this.kind, required this.text, required this.value, required this.onChanged});
  final ConsentKind kind;
  final String text;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final locale = ref.watch(localeProvider).languageCode;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => onChanged(!value),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Checkbox(value: value, onChanged: (v) => onChanged(v ?? false)),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 12, right: 4),
            child: Text.rich(
              TextSpan(children: [
                TextSpan(text: '$text '),
                WidgetSpan(
                  alignment: PlaceholderAlignment.baseline,
                  baseline: TextBaseline.alphabetic,
                  child: GestureDetector(
                    onTap: () => openLegal(kind.doc, locale),
                    child: Text(l.readConsentText,
                        style: TextStyle(color: Brand.coral, fontWeight: FontWeight.w600, decoration: TextDecoration.underline)),
                  ),
                ),
              ]),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ),
      ]),
    );
  }
}

// Bir özelliğin rızaya bağlı olduğu anda sorulur (ör. arama, mavi tik). true = rıza verildi.
Future<bool> askConsent(BuildContext context, WidgetRef ref, ConsentKind kind, {required String source}) async {
  final l = AppLocalizations.of(context);
  final (title, body) = switch (kind) {
    ConsentKind.overseasTransfer => (l.consentOverseasTitle, l.consentOverseasAsk),
    ConsentKind.selfie => (l.consentSelfieTitle, l.consentSelfieAsk),
    ConsentKind.specialCategory => (l.consentSpecialTitle, l.consentSpecialAsk),
    ConsentKind.marketing => (l.consentMarketingTitle, l.consentMarketingText),
    ConsentKind.marketingPush => (l.consentMarketingPushTitle, l.consentMarketingPushText),
    ConsentKind.analytics => (l.consentAnalyticsTitle, l.consentAnalyticsText),
  };
  final locale = ref.read(localeProvider).languageCode;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      icon: const Icon(Icons.privacy_tip_outlined, color: Brand.coral, size: 32),
      title: Text(title),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(body, textAlign: TextAlign.center),
        TextButton(onPressed: () => openLegal(kind.doc, locale), child: Text(l.readConsentText)),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.notNow)),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.giveConsent)),
      ],
    ),
  );
  if (ok != true || !context.mounted) return false;
  try {
    await ref.read(apiProvider).setConsent(kind, true, source: source);
    return true;
  } catch (e) {
    if (context.mounted) showSnack(context, errorText(l, e));
    return false;
  }
}
