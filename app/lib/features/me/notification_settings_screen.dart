import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Profil › Bildirimler: türe göre aç/kapa, sessiz saatler, kampanya izinleri (e-posta ve bildirim ayrı)

final _prefsProvider = FutureProvider.autoDispose<NotificationPrefs>((ref) => ref.watch(apiProvider).notificationPrefs());
final _consentsProvider = FutureProvider.autoDispose<ConsentState>((ref) => ref.watch(apiProvider).consents());

String _hm(int minutes) => '${(minutes ~/ 60).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';

class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends ConsumerState<NotificationSettingsScreen> {
  bool _busy = false;

  Future<void> _save({Map<NotifyType, bool>? prefs, ({bool enabled, int start, int end})? quiet}) async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).saveNotificationPrefs(prefs: prefs, quiet: quiet);
      ref.invalidate(_prefsProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _setConsent(ConsentKind kind, bool granted) async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).setConsent(kind, granted);
      ref.invalidate(_consentsProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<int?> _pickTime(int current) async {
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: current ~/ 60, minute: current % 60),
      builder: (ctx, child) => MediaQuery(data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: true), child: child!),
    );
    return t == null ? null : t.hour * 60 + t.minute;
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = ref.watch(localeProvider).languageCode;
    final prefs = ref.watch(_prefsProvider);
    final consents = ref.watch(_consentsProvider);
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant);

    Widget section(String title, [String? hint]) => Padding(
          padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
            if (hint != null) Text(hint, style: muted),
          ]),
        );

    final labels = {
      NotifyType.message: (Icons.chat_bubble_outline_rounded, l.notifyMessages),
      NotifyType.match: (Icons.favorite_border_rounded, l.notifyMatches),
      NotifyType.request: (Icons.mark_chat_unread_outlined, l.notifyRequests),
      NotifyType.call: (Icons.call_outlined, l.notifyCalls),
      NotifyType.like: (Icons.star_border_rounded, l.notifyLikes),
    };

    return Scaffold(
      appBar: AppBar(title: Text(l.notificationsTitle)),
      body: prefs.when(
        loading: () => const ListSkeleton(rows: 6),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_prefsProvider)),
        data: (p) => ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
          section(l.notifyTypesTitle, l.notifyTypesHint),
          Card(
            child: Column(children: [
              for (final (i, t) in NotifyType.values.indexed) ...[
                if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                SwitchListTile(
                  secondary: Icon(labels[t]!.$1),
                  title: Text(labels[t]!.$2),
                  value: p.of(t),
                  onChanged: _busy ? null : (v) => _save(prefs: {t: v}),
                ),
              ],
            ]),
          ),
          section(l.quietHoursTitle, l.quietHoursHint),
          Card(
            child: Column(children: [
              SwitchListTile(
                secondary: const Icon(Icons.bedtime_outlined),
                title: Text(l.quietHours),
                value: p.quietEnabled,
                onChanged: _busy ? null : (v) => _save(quiet: (enabled: v, start: p.quietStart, end: p.quietEnd)),
              ),
              if (p.quietEnabled) ...[
                const Divider(height: 1, indent: 16, endIndent: 16),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                  child: Row(children: [
                    for (final (i, (label, value)) in [(l.quietFrom, p.quietStart), (l.quietTo, p.quietEnd)].indexed) ...[
                      if (i > 0) const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Padding(padding: const EdgeInsets.only(left: 4, bottom: 4), child: Text(label, style: muted)),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              icon: const Icon(Icons.schedule_rounded, size: 18),
                              label: Text(_hm(value), style: const TextStyle(fontWeight: FontWeight.w700)),
                              onPressed: _busy
                                  ? null
                                  : () async {
                                      final v = await _pickTime(value);
                                      if (v == null) return;
                                      await _save(quiet: (enabled: true, start: i == 0 ? v : p.quietStart, end: i == 1 ? v : p.quietEnd));
                                    },
                            ),
                          ),
                        ]),
                      ),
                    ],
                  ]),
                ),
              ],
            ]),
          ),
          section(l.marketingTitle, l.marketingHint),
          consents.when(
            loading: () => const ListSkeleton(rows: 2),
            error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_consentsProvider)),
            data: (c) => Card(
              child: Column(children: [
                SwitchListTile(
                  secondary: const Icon(Icons.mail_outline_rounded),
                  title: Text(l.consentMarketingTitle),
                  subtitle: Text(l.consentMarketingText),
                  value: c.marketing,
                  onChanged: _busy ? null : (v) => _setConsent(ConsentKind.marketing, v),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                SwitchListTile(
                  secondary: const Icon(Icons.campaign_outlined),
                  title: Text(l.consentMarketingPushTitle),
                  subtitle: Text(l.consentMarketingPushText),
                  value: c.marketingPush,
                  onChanged: _busy ? null : (v) => _setConsent(ConsentKind.marketingPush, v),
                ),
              ]),
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(onPressed: () => openLegal('consent-marketing', locale), child: Text(l.readConsentText)),
          ),
          Text(l.requiredNotificationsNote, style: muted),
        ]),
      ),
    );
  }
}
