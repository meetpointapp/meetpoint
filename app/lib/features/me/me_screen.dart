import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/push.dart';
import '../../core/store.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Profil tamamlama yüzdesi: fotoğraf, soru ve temel bilgiler eşleşmeyi artırır
int profileCompletion(PublicProfile p) {
  var score = 0;
  score += (p.photos.length.clamp(0, 3)) * 10; // 30
  if (p.interests.length >= 3) score += 10;
  if (p.lookingFor.isNotEmpty) score += 10;
  score += p.prompts.length.clamp(0, 3) * 10; // 30
  if (p.bio.isNotEmpty) score += 10;
  final basics = [p.heightCm != null, p.job.isNotEmpty, p.education.isNotEmpty, p.zodiac.isNotEmpty, p.city.isNotEmpty]
      .where((b) => b)
      .length;
  if (basics >= 2) score += 10;
  return score.clamp(0, 100);
}

class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final me = ref.watch(meProvider);
    final locale = ref.watch(localeProvider).languageCode;

    return Scaffold(
      appBar: AppBar(title: Text(l.navProfile)),
      body: me.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(meProvider)),
        data: (m) {
          final p = m.profile;
          final percent = p == null ? 0 : profileCompletion(p);
          return RefreshIndicator(
            onRefresh: () => ref.refresh(meProvider.future),
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [
              // Fotoğraf + tamamlama halkası
              Center(
                child: SizedBox.square(
                  dimension: 132,
                  child: Stack(alignment: Alignment.center, children: [
                    SizedBox.square(
                      dimension: 132,
                      child: TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: percent / 100),
                        duration: const Duration(milliseconds: 700),
                        curve: Curves.easeOutCubic,
                        builder: (_, v, _) => CircularProgressIndicator(
                          value: v,
                          strokeWidth: 5,
                          strokeCap: StrokeCap.round,
                          color: Brand.coral,
                          backgroundColor: Brand.coral.withValues(alpha: 0.12),
                        ),
                      ),
                    ),
                    Avatar(p, radius: 56),
                    Positioned(
                      bottom: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: const ShapeDecoration(shape: StadiumBorder(), gradient: Brand.gradient),
                        child: Text('%$percent',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12)),
                      ),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              if (p != null)
                Center(
                  child: NameWithBadge('${p.displayName}, ${p.age}',
                      verified: m.verificationStatus == 'approved', style: theme.textTheme.headlineSmall),
                ),
              if (percent < 100)
                Center(
                  child: Text(l.profileCompletion(percent),
                      style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                ),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(
                  child: GradientButton(
                    label: l.editProfile,
                    icon: Icons.edit_rounded,
                    onPressed: () async {
                      await context.push('/me/edit');
                      ref.invalidate(meProvider);
                    },
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  height: 52,
                  child: OutlinedButton(
                    onPressed: () => context.go('/wallet'),
                    child: CoinAmount(m.balance, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  ),
                ),
              ]),
              const SizedBox(height: 16),
              _VerificationCard(status: m.verificationStatus),
              const SizedBox(height: 16),
              Card(
                child: Column(children: [
                  ListTile(
                    leading: const Icon(Icons.visibility_outlined),
                    title: Text(l.previewProfile),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/user/${m.id}'),
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  ListTile(
                    leading: const Icon(Icons.language_rounded),
                    title: Text(l.language),
                    trailing: SegmentedButton<String>(
                      showSelectedIcon: false,
                      style: const ButtonStyle(visualDensity: VisualDensity.compact),
                      segments: const [
                        ButtonSegment(value: 'tr', label: Text('TR')),
                        ButtonSegment(value: 'en', label: Text('EN')),
                      ],
                      selected: {locale},
                      onSelectionChanged: (s) => ref.read(localeProvider.notifier).set(s.first),
                    ),
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  ListTile(
                    leading: const Icon(Icons.devices_rounded),
                    title: Text(l.devicesTitle),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/me/devices'),
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  ListTile(
                    leading: const Icon(Icons.lock_outline_rounded),
                    title: Text(l.changePassword),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/me/password'),
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  ListTile(
                    leading: const Icon(Icons.logout_rounded),
                    title: Text(l.logout),
                    onTap: () async {
                      // Bu cihaza artık bu hesabın bildirimleri gelmesin
                      await Push.instance.unregister(ref.read(apiProvider));
                      await CoinStore.instance.logout();
                      await ref.read(sessionProvider.notifier).logout();
                    },
                  ),
                ]),
              ),
              const SizedBox(height: 12),
              Card(
                child: Column(children: [
                  ListTile(
                    leading: const Icon(Icons.description_outlined),
                    title: Text(l.termsOfService),
                    trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                    onTap: () => openLegal('terms', locale),
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  ListTile(
                    leading: const Icon(Icons.privacy_tip_outlined),
                    title: Text(l.privacyPolicy),
                    trailing: const Icon(Icons.open_in_new_rounded, size: 18),
                    onTap: () => openLegal('privacy', locale),
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  ListTile(
                    leading: Icon(Icons.delete_forever_outlined, color: theme.colorScheme.error),
                    title: Text(l.deleteAccount, style: TextStyle(color: theme.colorScheme.error)),
                    onTap: () => _deleteAccount(context, ref),
                  ),
                ]),
              ),
              const SizedBox(height: 12),
              Center(child: Text(m.email, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline))),
            ]),
          );
        },
      ),
    );
  }

  // Hesap silme: uyarı + şifre ile onay. Geri alınamaz.
  Future<void> _deleteAccount(BuildContext context, WidgetRef ref) async {
    final l = AppLocalizations.of(context);
    final password = await showDialog<String>(context: context, builder: (_) => const _DeleteAccountDialog());
    if (password == null || !context.mounted) return;
    try {
      await ref.read(apiProvider).deleteAccount(password);
      await ref.read(sessionProvider.notifier).logout();
      if (context.mounted) showSnack(context, l.accountDeleted);
    } catch (e) {
      if (context.mounted) showSnack(context, errorText(l, e));
    }
  }
}

class _DeleteAccountDialog extends StatefulWidget {
  const _DeleteAccountDialog();

  @override
  State<_DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends State<_DeleteAccountDialog> {
  final _password = TextEditingController();

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final error = Theme.of(context).colorScheme.error;
    return AlertDialog(
      icon: Icon(Icons.warning_amber_rounded, color: error, size: 32),
      title: Text(l.deleteAccount),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(l.deleteAccountWarning, textAlign: TextAlign.center),
        const SizedBox(height: 16),
        TextField(
          controller: _password,
          obscureText: true,
          autofillHints: const [AutofillHints.password],
          decoration: InputDecoration(hintText: l.confirmWithPassword),
          onChanged: (_) => setState(() {}),
        ),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(l.cancel)),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: error),
          onPressed: _password.text.isEmpty ? null : () => Navigator.pop(context, _password.text),
          child: Text(l.deleteAccount),
        ),
      ],
    );
  }
}

// Mavi tik durumu: başvur / inceleniyor / doğrulandı / tekrar dene
class _VerificationCard extends StatelessWidget {
  const _VerificationCard({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    const blue = Color(0xFF2F80ED);
    final (icon, title, subtitle, actionable) = switch (status) {
      'approved' => (Icons.verified_rounded, l.verifiedLabel, null, false),
      'pending' => (Icons.hourglass_top_rounded, l.verificationPendingLabel, l.verificationSubmitted, false),
      'rejected' => (Icons.verified_outlined, l.verifyProfile, l.verificationRejectedLabel, true),
      _ => (Icons.verified_outlined, l.verifyProfile, l.verifyProfileHint, true),
    };
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(shape: BoxShape.circle, color: blue.withValues(alpha: 0.12)),
          child: Icon(icon, color: blue),
        ),
        title: Text(title, style: theme.textTheme.titleSmall),
        subtitle: subtitle == null ? null : Text(subtitle),
        trailing: actionable ? const Icon(Icons.chevron_right_rounded) : null,
        onTap: actionable ? () => context.push('/verify-profile') : null,
      ),
    );
  }
}
