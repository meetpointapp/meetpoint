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
import '../privacy/consent_widgets.dart';
import '../privacy/privacy_screen.dart';

String callKindLabel(AppLocalizations l, CallKind k) => k == CallKind.video ? l.videoCall : l.voiceCall;

IconData callKindIcon(CallKind k) => k == CallKind.video ? Icons.videocam_rounded : Icons.call_rounded;

// Dakika başı ücretli arama başlat: fiyatı onaylat, aramayı aç, arama ekranına geç
Future<void> startCallFlow(BuildContext context, WidgetRef ref, PublicProfile profile, CallKind kind) async {
  final l = AppLocalizations.of(context);
  final int? rate;
  try {
    rate = (await ref.read(walletProvider.future)).callRates[kind];
  } catch (e) {
    if (context.mounted) showSnack(context, errorText(l, e));
    return;
  }
  if (rate == null || !context.mounted) return;

  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      icon: Icon(callKindIcon(kind), color: Brand.coral, size: 32),
      title: Text(l.startCallTitle(callKindLabel(l, kind))),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Avatar(profile, radius: 32),
        const SizedBox(height: 8),
        Text(profile.displayName, style: Theme.of(ctx).textTheme.titleMedium),
        const SizedBox(height: 12),
        Text(l.startCallInfo(rate!), textAlign: TextAlign.center),
        const SizedBox(height: 8),
        // Arama öncesi kurallar hatırlatması
        Text(l.callRulesReminder, textAlign: TextAlign.center, style: Theme.of(ctx).textTheme.bodySmall),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
        FilledButton.icon(
          onPressed: () => Navigator.pop(ctx, true),
          icon: Icon(callKindIcon(kind), size: 18),
          label: Text('${l.callAction} · ${l.perMinute(rate)}'),
        ),
      ],
    ),
  );
  if (ok != true || !context.mounted) return;

  try {
    final call = await ref.read(apiProvider).startCall(profile.id, kind);
    if (context.mounted) context.push('/call/${call.id}', extra: call);
  } catch (e) {
    if (!context.mounted) return;
    // Aramalar yurt dışındaki sunuculardan geçer: rıza yoksa sor, verirse aramayı tekrar başlat
    if (missingConsent(e) == ConsentKind.overseasTransfer) {
      if (await askConsent(context, ref, ConsentKind.overseasTransfer, source: 'call') && context.mounted) {
        return startCallFlow(context, ref, profile, kind);
      }
      return;
    }
    final lowBalance = e is ApiException && e.code == 'insufficient_balance';
    showSnack(
      context,
      errorText(l, e),
      action: lowBalance ? SnackBarAction(label: l.topUp, onPressed: () => context.go('/wallet')) : null,
    );
  }
}
