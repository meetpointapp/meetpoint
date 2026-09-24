import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

final _consentsProvider = FutureProvider.autoDispose<ConsentState>((ref) => ref.watch(apiProvider).consents());
final _exportProvider = FutureProvider.autoDispose<DataExportInfo?>((ref) => ref.watch(apiProvider).dataExport());
final _kvkkRequestsProvider = FutureProvider.autoDispose<List<KvkkRequest>>((ref) => ref.watch(apiProvider).kvkkRequests());

// Profil › Gizlilik ve verilerim: açık rızalar, veri kopyası, KVKK başvurusu, metinler
class PrivacyScreen extends ConsumerWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = ref.watch(localeProvider).languageCode;
    final consents = ref.watch(_consentsProvider);
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant);

    Widget section(String title) => Padding(
          padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
          child: Text(title, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
        );

    return Scaffold(
      appBar: AppBar(title: Text(l.privacyAndData)),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
        section(l.myConsents),
        consents.when(
          loading: () => const ListSkeleton(rows: 4),
          error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_consentsProvider)),
          data: (c) => Card(
            child: Column(children: [
              for (final (i, k) in [
                ConsentKind.specialCategory,
                if (c.overseasConsentRequired) ConsentKind.overseasTransfer,
                ConsentKind.selfie,
                ConsentKind.marketing,
              ].indexed) ...[
                if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                _ConsentSwitch(kind: k, value: c.of(k)),
              ],
            ]),
          ),
        ),
        section(l.myData),
        const Card(child: _DataExportTile()),
        const SizedBox(height: 8),
        Card(
          child: ListTile(
            leading: const Icon(Icons.mark_email_unread_outlined),
            title: Text(l.kvkkRequestTitle),
            subtitle: Text(l.kvkkRequestSubtitle, style: muted),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => showModalBottomSheet<void>(
              context: context,
              isScrollControlled: true,
              showDragHandle: true,
              builder: (_) => const _KvkkRequestSheet(),
            ),
          ),
        ),
        section(l.legalTexts),
        Card(
          child: Column(children: [
            for (final (i, (doc, label)) in [
              ('privacy', l.privacyPolicy),
              ('retention', l.retentionPolicy),
              ('terms', l.termsOfService),
            ].indexed) ...[
              if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
              ListTile(
                leading: const Icon(Icons.description_outlined),
                title: Text(label),
                trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                onTap: () => openLegal(doc, locale),
              ),
            ],
          ]),
        ),
      ]),
    );
  }
}

class _ConsentSwitch extends ConsumerStatefulWidget {
  const _ConsentSwitch({required this.kind, required this.value});
  final ConsentKind kind;
  final bool value;

  @override
  ConsumerState<_ConsentSwitch> createState() => _ConsentSwitchState();
}

class _ConsentSwitchState extends ConsumerState<_ConsentSwitch> {
  bool _busy = false;

  Future<void> _set(bool granted) async {
    final l = AppLocalizations.of(context);
    // Geri almanın sonucu olan rızalarda önce ne olacağı söylenir
    final warning = switch (widget.kind) {
      ConsentKind.specialCategory => l.revokeSpecialWarning,
      ConsentKind.overseasTransfer => l.revokeOverseasWarning,
      ConsentKind.selfie => l.revokeSelfieWarning,
      ConsentKind.marketing => null,
    };
    if (!granted && warning != null) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(l.revokeConsentTitle),
          content: Text(warning),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.revokeConsent)),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).setConsent(widget.kind, granted);
      ref.invalidate(_consentsProvider);
      ref.invalidate(meProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final locale = ref.watch(localeProvider).languageCode;
    final (title, subtitle) = switch (widget.kind) {
      ConsentKind.specialCategory => (l.consentSpecialTitle, l.consentSpecialText),
      ConsentKind.overseasTransfer => (l.consentOverseasTitle, l.consentOverseasText),
      ConsentKind.selfie => (l.consentSelfieTitle, l.consentSelfieText),
      ConsentKind.marketing => (l.consentMarketingTitle, l.consentMarketingText),
    };
    return SwitchListTile(
      value: widget.value,
      onChanged: _busy ? null : _set,
      title: Text(title),
      subtitle: Text.rich(TextSpan(children: [
        TextSpan(text: '$subtitle '),
        WidgetSpan(
          alignment: PlaceholderAlignment.baseline,
          baseline: TextBaseline.alphabetic,
          child: GestureDetector(
            onTap: () => openLegal(widget.kind.doc, locale),
            child: Text(l.readConsentText, style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w600)),
          ),
        ),
      ])),
    );
  }
}

class _DataExportTile extends ConsumerStatefulWidget {
  const _DataExportTile();

  @override
  ConsumerState<_DataExportTile> createState() => _DataExportTileState();
}

class _DataExportTileState extends ConsumerState<_DataExportTile> {
  bool _busy = false;

  Future<void> _request() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).requestDataExport();
      if (mounted) showSnack(context, l.dataExportRequested);
      ref.invalidate(_exportProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final info = ref.watch(_exportProvider).value;
    final date = DateFormat.yMMMd(l.localeName);
    final status = switch (info) {
      null => l.dataExportSubtitle,
      final x when x.preparing => l.dataExportPreparing,
      final x when x.status == 'READY' => l.dataExportReady(date.format(x.expiresAt ?? DateTime.now())),
      final x when !x.canRequest => l.dataExportNextAt(date.format(x.nextAt!)),
      _ => l.dataExportSubtitle,
    };
    final canRequest = info == null || (info.canRequest && !info.preparing);
    return ListTile(
      leading: const Icon(Icons.download_rounded),
      title: Text(l.dataExportTitle),
      subtitle: Text(status),
      trailing: _busy
          ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
          : TextButton(onPressed: canRequest ? _request : null, child: Text(l.dataExportAction)),
    );
  }
}

class _KvkkRequestSheet extends ConsumerStatefulWidget {
  const _KvkkRequestSheet();

  @override
  ConsumerState<_KvkkRequestSheet> createState() => _KvkkRequestSheetState();
}

class _KvkkRequestSheetState extends ConsumerState<_KvkkRequestSheet> {
  final _message = TextEditingController();
  String _kind = 'info';
  bool _busy = false;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).sendKvkkRequest(_kind, _message.text.trim());
      _message.clear();
      ref.invalidate(_kvkkRequestsProvider);
      if (mounted) showSnack(context, l.kvkkRequestSent);
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
    final requests = ref.watch(_kvkkRequestsProvider).value ?? const [];
    final kinds = {
      'info': l.kvkkKindInfo,
      'correction': l.kvkkKindCorrection,
      'deletion': l.kvkkKindDeletion,
      'objection': l.kvkkKindObjection,
      'other': l.kvkkKindOther,
    };
    final date = DateFormat.yMMMd(l.localeName);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(l.kvkkRequestTitle, style: theme.textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(l.kvkkRequestInfo, style: theme.textTheme.bodySmall),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _kind,
            items: [for (final e in kinds.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
            onChanged: (v) => setState(() => _kind = v ?? 'info'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _message,
            minLines: 3,
            maxLines: 6,
            maxLength: 2000,
            decoration: InputDecoration(hintText: l.kvkkRequestHint),
            onChanged: (_) => setState(() {}),
          ),
          FilledButton(
            onPressed: _busy || _message.text.trim().length < 10 ? null : _send,
            child: Text(l.send),
          ),
          if (requests.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(l.kvkkMyRequests, style: theme.textTheme.titleSmall),
            for (final r in requests)
              Card(
                child: ListTile(
                  title: Text('${kinds[r.kind] ?? r.kind} · ${date.format(r.createdAt)}'),
                  subtitle: Text(r.status == 'OPEN' ? l.kvkkRequestPending(date.format(r.dueAt)) : r.answer),
                  trailing: Icon(r.status == 'OPEN' ? Icons.hourglass_top_rounded : Icons.mark_email_read_outlined),
                ),
              ),
          ],
        ]),
      ),
    );
  }
}

// Arama/mavi tik gibi rızaya bağlı bir işlem reddedildiğinde hangi rızanın eksik olduğu
ConsentKind? missingConsent(Object error) =>
    error is ApiException && error.code == 'consent_required' ? ConsentKind.fromApi(error.data['kind']) : null;
