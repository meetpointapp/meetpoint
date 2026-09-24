import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

final _kycProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) => ref.watch(apiProvider).kyc());

// Para çekme öncesi kimlik doğrulama: ad-soyad, TC, kimlik kartı fotoğrafı (bir kez)
class KycCard extends ConsumerStatefulWidget {
  const KycCard({super.key});

  @override
  ConsumerState<KycCard> createState() => _KycCardState();
}

class _KycCardState extends ConsumerState<KycCard> {
  final _name = TextEditingController();
  final _tc = TextEditingController();
  XFile? _doc;
  Uint8List? _preview;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _tc.dispose();
    super.dispose();
  }

  bool get _valid => _name.text.trim().split(RegExp(r'\s+')).length >= 2 && _tc.text.length == 11 && _doc != null;

  Future<void> _pick() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2000, imageQuality: 90);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    setState(() {
      _doc = file;
      _preview = bytes;
    });
  }

  Future<void> _submit() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).submitKyc(fullName: _name.text.trim(), tcNo: _tc.text, document: _doc!);
      if (mounted) showSnack(context, l.kycSent);
      ref.invalidate(_kycProvider);
      ref.invalidate(walletProvider);
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
    final kyc = ref.watch(_kycProvider).value;
    final status = kyc?['status'] as String? ?? 'none';
    if (status == 'pending') {
      return Card(child: ListTile(leading: const Icon(Icons.hourglass_top_rounded, color: Brand.coral), title: Text(l.kycPending)));
    }
    final note = (kyc?['last'] as Map?)?['note'] as String? ?? '';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            const Icon(Icons.badge_outlined, color: Brand.coral),
            const SizedBox(width: 8),
            Text(l.kycTitle, style: theme.textTheme.titleMedium),
          ]),
          const SizedBox(height: 8),
          if (status == 'rejected') ...[
            Text(note.isEmpty ? l.kycRejected : '${l.kycRejected}\n$note', style: TextStyle(color: theme.colorScheme.error)),
            const SizedBox(height: 8),
          ],
          Text(l.kycInfo, style: theme.textTheme.bodySmall),
          const SizedBox(height: 12),
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(labelText: l.kycFullName),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _tc,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
            decoration: InputDecoration(labelText: l.kycTcNo),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          Text(l.kycDocument, style: theme.textTheme.labelLarge),
          const SizedBox(height: 6),
          if (_preview != null)
            ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.memory(_preview!, height: 140, fit: BoxFit.cover)),
          OutlinedButton.icon(onPressed: _pick, icon: const Icon(Icons.photo_camera_back_outlined), label: Text(l.kycPickDocument)),
          const SizedBox(height: 12),
          GradientButton(label: l.kycSubmit, busy: _busy, onPressed: _valid ? _submit : null),
        ]),
      ),
    );
  }
}

// Yıllık kazanç dökümü (vergi beyanı için)
Future<void> showEarningsStatement(BuildContext context, WidgetRef ref) async {
  final l = AppLocalizations.of(context);
  final year = DateTime.now().year;
  try {
    final s = await ref.read(apiProvider).earnings(year);
    if (!context.mounted) return;
    String usd(double v) => '\$${v.toStringAsFixed(2)}';
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.receipt_long_outlined, color: Brand.coral, size: 32),
        title: Text(l.earningsStatement),
        content: Text(l.earningsStatementBody(s.year, s.earnedCoins, s.payoutCount, usd(s.grossUsd), usd(s.withholdingUsd), usd(s.netUsd))),
        actions: [FilledButton(onPressed: () => Navigator.pop(ctx), child: Text(l.understood))],
      ),
    );
  } catch (e) {
    if (context.mounted) showSnack(context, errorText(l, e));
  }
}
