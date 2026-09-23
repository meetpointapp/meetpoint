import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Ücretli iletişim isteği gönderme akışı (profil sayfası ve keşfet kartı ortak kullanır).
// Başarılıysa true döner.
Future<bool> sendContactRequest(BuildContext context, WidgetRef ref, PublicProfile profile, RequestKind kind) async {
  final l = AppLocalizations.of(context);
  final WalletInfo wallet;
  try {
    wallet = await ref.read(walletProvider.future);
  } catch (e) {
    if (context.mounted) showSnack(context, errorText(l, e));
    return false;
  }
  final price = wallet.requestPrices[kind];
  if (price == null || !context.mounted) return false;

  var note = '';
  if (kind == RequestKind.message) {
    final text = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _MessageRequestSheet(profile: profile, price: price),
    );
    if (text == null) return false;
    note = text;
  } else {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: Icon(requestKindIcon(kind), color: Brand.coral, size: 32),
        title: Text(l.confirmRequestTitle(requestKindLabel(l, kind))),
        content: Text(l.requestCostInfo(price), textAlign: TextAlign.center),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.send)),
        ],
      ),
    );
    if (ok != true) return false;
  }

  try {
    await ref.read(apiProvider).sendRequest(profile.id, kind, note: note);
    ref.invalidate(walletProvider);
    ref.invalidate(meProvider);
    ref.invalidate(requestsProvider(false));
    if (context.mounted) showSnack(context, l.requestSent);
    return true;
  } catch (e) {
    if (!context.mounted) return false;
    final lowBalance = e is ApiException && e.code == 'insufficient_balance';
    showSnack(
      context,
      errorText(l, e),
      action: lowBalance ? SnackBarAction(label: l.topUp, onPressed: () => context.go('/wallet')) : null,
    );
    return false;
  }
}

class _MessageRequestSheet extends StatefulWidget {
  const _MessageRequestSheet({required this.profile, required this.price});
  final PublicProfile profile;
  final int price;

  @override
  State<_MessageRequestSheet> createState() => _MessageRequestSheetState();
}

class _MessageRequestSheetState extends State<_MessageRequestSheet> {
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Avatar(widget.profile, radius: 22),
          const SizedBox(width: 12),
          Expanded(child: Text(l.requestDialogTitle(widget.profile.displayName), style: theme.textTheme.titleMedium)),
        ]),
        const SizedBox(height: 16),
        TextField(
          controller: _text,
          autofocus: true,
          maxLines: 4,
          minLines: 3,
          maxLength: 500,
          decoration: InputDecoration(hintText: l.requestDialogHint),
          onChanged: (_) => setState(() {}),
        ),
        Text(l.requestCostInfo(widget.price),
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 16),
        GradientButton(
          label: '${l.send} · ${l.coins(widget.price)}',
          icon: Icons.send_rounded,
          onPressed: _text.text.trim().isEmpty ? null : () => Navigator.pop(context, _text.text.trim()),
        ),
      ]),
    );
  }
}
