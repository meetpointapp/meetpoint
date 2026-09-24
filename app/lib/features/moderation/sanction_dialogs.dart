import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

String sanctionReasonLabel(AppLocalizations l, String reason) => switch (reason) {
      'fake_profile' => l.reasonFake,
      'inappropriate_content' => l.reasonInappropriate,
      'harassment' => l.reasonHarassment,
      'scam' => l.reasonScam,
      'underage' => l.reasonUnderage,
      'spam' => l.reasonSpam,
      'report_burst' => l.reasonReportBurst,
      _ => l.reasonOther,
    };

// Uyarı / kısıt bildirimi: bir kez gösterilir; kullanıcı her karara bir kez itiraz edebilir
Future<void> showSanctionDialog(BuildContext context, WidgetRef ref, Sanction s) async {
  final l = AppLocalizations.of(context);
  final date = DateFormat.yMMMd(l.localeName).add_Hm();
  final (title, icon) = switch (s.level) {
    'warning' => (l.sanctionWarningTitle, Icons.warning_amber_rounded),
    'ban' => (l.sanctionBanTitle, Icons.block_rounded),
    _ => (l.sanctionRestrictTitle, Icons.lock_clock_outlined),
  };
  final appeal = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => AlertDialog(
      icon: Icon(icon, color: Brand.coral, size: 32),
      title: Text(title),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(l.sanctionReason(sanctionReasonLabel(l, s.reason)), style: const TextStyle(fontWeight: FontWeight.w600)),
        if (s.note.isNotEmpty) ...[const SizedBox(height: 8), Text(s.note, textAlign: TextAlign.center)],
        const SizedBox(height: 8),
        Text(s.endsAt != null ? l.sanctionUntil(date.format(s.endsAt!)) : l.sanctionWarningBody, textAlign: TextAlign.center),
        if (!s.canAppeal) ...[const SizedBox(height: 8), Text(l.sanctionAppealed, style: Theme.of(ctx).textTheme.bodySmall)],
      ]),
      actions: [
        if (s.canAppeal) TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.appeal)),
        FilledButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.understood)),
      ],
    ),
  );
  final api = ref.read(apiProvider);
  await api.sanctionSeen(s.id).catchError((_) {});
  if (appeal == true && context.mounted) {
    await _appealSheet(context, (message) => api.appeal(s.id, message));
  }
}

// Yasaklı hesapla giriş denemesi: sebep ve (itiraz edilmediyse) itiraz formu
Future<void> showBannedDialog(BuildContext context, WidgetRef ref, Map<String, dynamic> data) async {
  final l = AppLocalizations.of(context);
  final token = data['appealToken'] as String?;
  final reason = data['reason'] as String?;
  final note = (data['note'] as String?) ?? '';
  final appeal = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      icon: const Icon(Icons.block_rounded, color: Brand.coral, size: 32),
      title: Text(l.sanctionBanTitle),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(l.errBanned, textAlign: TextAlign.center),
        if (reason != null) ...[const SizedBox(height: 8), Text(l.sanctionReason(sanctionReasonLabel(l, reason)))],
        if (note.isNotEmpty) ...[const SizedBox(height: 8), Text(note, textAlign: TextAlign.center)],
        if (data['appealed'] == true) ...[const SizedBox(height: 8), Text(l.sanctionAppealed)],
      ]),
      actions: [
        if (token != null) TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.appeal)),
        FilledButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.understood)),
      ],
    ),
  );
  if (appeal == true && token != null && context.mounted) {
    await _appealSheet(context, (message) => Api(null).appealBanned(token, message));
  }
}

Future<void> _appealSheet(BuildContext context, Future<void> Function(String message) send) async {
  final l = AppLocalizations.of(context);
  final controller = TextEditingController();
  var busy = false; // oluşturucunun dışında: yeniden çizimde sıfırlanmasın
  try {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) {
          return Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(ctx).bottom),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(l.appeal, style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 8),
              TextField(
                controller: controller,
                minLines: 3,
                maxLines: 6,
                maxLength: 2000,
                decoration: InputDecoration(hintText: l.appealHint),
                onChanged: (_) => setState(() {}),
              ),
              FilledButton(
                onPressed: busy || controller.text.trim().length < 10
                    ? null
                    : () async {
                        setState(() => busy = true);
                        try {
                          await send(controller.text.trim());
                          if (ctx.mounted) Navigator.pop(ctx);
                          if (context.mounted) showSnack(context, l.appealSent);
                        } catch (e) {
                          if (ctx.mounted) showSnack(ctx, errorText(l, e));
                          setState(() => busy = false);
                        }
                      },
                child: Text(l.send),
              ),
            ]),
          );
        },
      ),
    );
  } finally {
    controller.dispose();
  }
}
