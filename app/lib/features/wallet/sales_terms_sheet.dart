import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Satın alma öncesi onay: ön bilgilendirme formu + mesafeli satış sözleşmesi + cayma hakkı istisnası.
// İlk satın almadan önce (veya metinler değişince) bir kez gösterilir. true: onaylandı ve kaydedildi.
Future<bool> ensureSalesTerms(BuildContext context, {required bool updated}) async =>
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _SalesTermsSheet(updated: updated),
    ) ==
    true;

class _SalesTermsSheet extends ConsumerStatefulWidget {
  const _SalesTermsSheet({required this.updated});
  final bool updated;

  @override
  ConsumerState<_SalesTermsSheet> createState() => _SalesTermsSheetState();
}

class _SalesTermsSheetState extends ConsumerState<_SalesTermsSheet> {
  bool _checked = false;
  bool _busy = false;

  Future<void> _accept() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).acceptSalesTerms();
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        showSnack(context, errorText(l, e));
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = ref.watch(localeProvider).languageCode;
    final link = TextStyle(color: Brand.coral, fontWeight: FontWeight.w700, decoration: TextDecoration.underline, decorationColor: Brand.coral);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Text('🧾', style: TextStyle(fontSize: 26)),
            const SizedBox(width: 10),
            Expanded(child: Text(widget.updated ? l.salesTermsUpdatedTitle : l.salesTermsTitle, style: theme.textTheme.titleLarge)),
          ]),
          const SizedBox(height: 12),
          Text(l.salesTermsIntro, style: theme.textTheme.bodyMedium),
          const SizedBox(height: 12),
          // Belgeler: dokununca tarayıcıda açılır
          Card(
            margin: EdgeInsets.zero,
            child: Column(children: [
              ListTile(
                dense: true,
                leading: const Icon(Icons.description_outlined),
                title: Text(l.preInfoForm),
                trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                onTap: () => openLegal('preinfo', locale),
              ),
              const Divider(height: 1, indent: 16, endIndent: 16),
              ListTile(
                dense: true,
                leading: const Icon(Icons.handshake_outlined),
                title: Text(l.distanceSalesContract),
                trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                onTap: () => openLegal('distance-sales', locale),
              ),
            ]),
          ),
          const SizedBox(height: 12),
          // Açık onay: kutu işaretlenmeden devam edilemez (önceden işaretli gelmez)
          InkWell(
            borderRadius: BorderRadius.circular(Brand.radius),
            onTap: _busy ? null : () => setState(() => _checked = !_checked),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Checkbox(value: _checked, onChanged: _busy ? null : (v) => setState(() => _checked = v ?? false)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text.rich(TextSpan(style: theme.textTheme.bodySmall, children: [
                    TextSpan(text: l.salesTermsCheckboxA),
                    TextSpan(text: l.preInfoForm, style: link, recognizer: TapGestureRecognizer()..onTap = () => openLegal('preinfo', locale)),
                    TextSpan(text: l.salesTermsCheckboxAnd),
                    TextSpan(text: l.distanceSalesContract, style: link, recognizer: TapGestureRecognizer()..onTap = () => openLegal('distance-sales', locale)),
                    TextSpan(text: l.salesTermsCheckboxB),
                  ])),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 16),
          GradientButton(label: l.salesTermsAccept, busy: _busy, onPressed: _checked ? _accept : null),
          const SizedBox(height: 4),
          Center(child: TextButton(onPressed: _busy ? null : () => Navigator.pop(context, false), child: Text(l.cancel))),
        ]),
      ),
    );
  }
}
