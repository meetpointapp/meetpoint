import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

final _sessionsProvider = FutureProvider.autoDispose<List<DeviceSession>>((ref) => ref.watch(apiProvider).sessions());

// Cihazlarım: hesabın açık olduğu cihazlar. Tanınmayan cihaz tek dokunuşla çıkarılır.
class DevicesScreen extends ConsumerWidget {
  const DevicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final sessions = ref.watch(_sessionsProvider);

    Future<void> run(Future<void> Function() action, String done) async {
      try {
        await action();
        ref.invalidate(_sessionsProvider);
        if (context.mounted) showSnack(context, done);
      } catch (e) {
        if (context.mounted) showSnack(context, errorText(l, e));
      }
    }

    return Scaffold(
      appBar: AppBar(title: Text(l.devicesTitle)),
      body: sessions.when(
        loading: () => const ListSkeleton(rows: 3),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_sessionsProvider)),
        data: (list) {
          final others = list.where((s) => !s.current).length;
          final fmt = DateFormat.yMMMd(l.localeName).add_Hm();
          return RefreshIndicator(
            onRefresh: () => ref.refresh(_sessionsProvider.future),
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [
              Text(l.devicesSubtitle, style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              const SizedBox(height: 12),
              Card(
                child: Column(children: [
                  for (final (i, s) in list.indexed) ...[
                    if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                    ListTile(
                      leading: Icon(switch (s.platform) {
                        'ios' || 'android' => Icons.smartphone_rounded,
                        'web' => Icons.language_rounded,
                        _ => Icons.devices_other_rounded,
                      }),
                      title: Row(children: [
                        Flexible(child: Text(s.deviceName, overflow: TextOverflow.ellipsis)),
                        if (s.current) ...[
                          const SizedBox(width: 8),
                          Chip(
                            label: Text(l.thisDevice),
                            visualDensity: VisualDensity.compact,
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                        ],
                      ]),
                      subtitle: Text('${l.lastActive(fmt.format(s.lastUsedAt))}${s.ip.isEmpty ? '' : ' · ${s.ip}'}'),
                      trailing: s.current
                          ? null
                          : IconButton(
                              tooltip: l.signOutDevice,
                              icon: const Icon(Icons.logout_rounded),
                              onPressed: () => run(() => ref.read(apiProvider).revokeSession(s.id), l.deviceSignedOut),
                            ),
                    ),
                  ],
                ]),
              ),
              if (others > 0) ...[
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  icon: const Icon(Icons.phonelink_erase_rounded),
                  label: Text(l.signOutOthers),
                  onPressed: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: Text(l.signOutOthers),
                        content: Text(l.signOutOthersConfirm),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)),
                          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.signOutDevice)),
                        ],
                      ),
                    );
                    if (ok == true) await run(() => ref.read(apiProvider).revokeOtherSessions(), l.othersSignedOut);
                  },
                ),
              ],
            ]),
          );
        },
      ),
    );
  }
}

// Şifre değiştir: mevcut şifre ile. Başarılı olunca bu cihaz dışındaki oturumlar kapanır.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  bool _busy = false;
  bool _show = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).changePassword(_current.text, _next.text);
      if (!mounted) return;
      showSnack(context, l.passwordChanged);
      Navigator.of(context).pop();
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final valid = _current.text.isNotEmpty && _next.text.length >= 8;
    return Scaffold(
      appBar: AppBar(title: Text(l.changePassword)),
      body: AutofillGroup(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          TextField(
            controller: _current,
            obscureText: !_show,
            autofillHints: const [AutofillHints.password],
            decoration: InputDecoration(labelText: l.currentPassword),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _next,
            obscureText: !_show,
            autofillHints: const [AutofillHints.newPassword],
            decoration: InputDecoration(
              labelText: l.newPassword,
              helperText: l.passwordHint,
              suffixIcon: IconButton(
                icon: Icon(_show ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                onPressed: () => setState(() => _show = !_show),
              ),
            ),
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => valid && !_busy ? _submit() : null,
          ),
          const SizedBox(height: 8),
          Text(l.changePasswordNote, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 20),
          GradientButton(label: l.save, busy: _busy, onPressed: valid ? _submit : null),
        ]),
      ),
    );
  }
}
