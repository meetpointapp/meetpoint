import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/push.dart';
import '../../core/store.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../feed/social_widgets.dart';
import '../../l10n/app_localizations.dart';
import '../onboarding/intro_screen.dart';
import '../profile/photo_viewer.dart';
import '../support/support_screens.dart';

// Profil tamamlama yüzdesi: fotoğraf, soru ve temel bilgiler eşleşmeyi artırır
int profileCompletion(PublicProfile p) {
  var score = 0;
  score += (p.photos.length.clamp(0, 3)) * 10; // 30
  if (p.interests.length >= 3) score += 10;
  if (p.lookingFor.isNotEmpty) score += 10;
  score += p.prompts.length.clamp(0, 3) * 10; // 30
  if (p.bio.isNotEmpty) score += 10;
  final basics = [
    p.heightCm != null,
    p.job.isNotEmpty,
    p.education.isNotEmpty,
    p.zodiac.isNotEmpty,
    p.city.isNotEmpty,
  ].where((b) => b).length;
  if (basics >= 2) score += 10;
  return score.clamp(0, 100);
}

// Faz 17 madde 7: haftalık özet — GET /me'nin parçası değil (daha ağır, daha seyrek istenen bir
// hesaplama), bu yüzden ayrı bir provider ile isteniyor (journeyNextStep ile aynı yaklaşım).
final weeklyDigestProvider = FutureProvider.autoDispose<WeeklyDigest>(
  (ref) => ref.watch(apiProvider).weeklyDigest(),
);

class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final me = ref.watch(meProvider);
    final locale = ref.watch(localeProvider).languageCode;
    // Destek yanıtı gelmiş ama okunmamış talepler
    final supportUnread = ref.watch(supportInboxProvider).value?.unread ?? 0;

    return Scaffold(
      appBar: AppBar(title: Text(l.navProfile)),
      body: me.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) =>
            ErrorRetry(error: e, onRetry: () => ref.invalidate(meProvider)),
        data: (m) {
          final p = m.profile;
          final percent = p == null ? 0 : profileCompletion(p);
          return RefreshIndicator(
            onRefresh: () => ref.refresh(meProvider.future),
            child: Theme(
              data: theme.copyWith(
                listTileTheme: ListTileThemeData(
                  dense: true,
                  visualDensity: VisualDensity.compact,
                  minLeadingWidth: 24,
                  horizontalTitleGap: 12,
                  titleTextStyle: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600, color: theme.colorScheme.onSurface),
                  subtitleTextStyle: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
              ),
              child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: [
                // Faz 20: kompakt başlık — küçük avatar (dokununca fotoğraf büyür), isim, tamamlama çubuğu
                _MeHeader(
                  profile: p,
                  percent: percent,
                  verified: m.verificationStatus == 'approved',
                  premiumUntil: m.premiumUntil,
                  balance: m.balance,
                  onEdit: () async {
                    await context.push('/me/edit');
                    ref.invalidate(meProvider);
                  },
                  onWallet: () => context.go('/wallet'),
                ),
                const SizedBox(height: 10),
                // Faz 20: dört büyük kart yerine tek satırda üç kompakt kutu (seri, yolculuk, doğrulama)
                _QuickStats(me: m),
                const SizedBox(height: 10),
                // Faz 22: takipçi/takip/gönderi sayıları ve mağaza girişi (mağaza alt menüden buraya taşındı)
                Card(
                  margin: EdgeInsets.zero,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    child: SocialCounts(userId: m.id, stats: m.social, isMe: true),
                  ),
                ),
                const SizedBox(height: 10),
                _StoreEntryCard(onTap: () => context.push('/store')),
                const SizedBox(height: 14),
                const _WeeklyDigestCard(),
                const SizedBox(height: 14),
                Card(
                  child: Column(
                    children: [
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
                          style: const ButtonStyle(
                            visualDensity: VisualDensity.compact,
                          ),
                          segments: const [
                            ButtonSegment(value: 'tr', label: Text('TR')),
                            ButtonSegment(value: 'en', label: Text('EN')),
                          ],
                          selected: {locale},
                          onSelectionChanged: (s) =>
                              ref.read(localeProvider.notifier).set(s.first),
                        ),
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      ListTile(
                        leading: const Icon(Icons.notifications_none_rounded),
                        title: Text(l.notificationsTitle),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => context.push('/me/notifications'),
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      _CallSettings(me: m),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      ListTile(
                        leading: const Icon(Icons.card_giftcard_rounded),
                        title: Text(l.referralTitle),
                        subtitle: Text(l.referralMenuHint),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => context.push('/referral'),
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      ListTile(
                        leading: const Icon(Icons.support_agent_rounded),
                        title: Text(l.helpAndSupport),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (supportUnread > 0)
                              Badge(
                                label: Text('$supportUnread'),
                                backgroundColor: Brand.coral,
                              ),
                            const Icon(Icons.chevron_right_rounded),
                          ],
                        ),
                        onTap: () async {
                          await context.push('/help');
                          ref.invalidate(supportInboxProvider);
                        },
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      ListTile(
                        leading: const Icon(Icons.feedback_outlined),
                        title: Text(l.sendFeedback),
                        subtitle: Text(l.sendFeedbackHint),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => openNewTicket(
                          context,
                          category: SupportCategory.suggestion,
                        ),
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      ListTile(
                        leading: const Icon(Icons.tips_and_updates_outlined),
                        title: Text(l.howItWorks),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => showIntro(context),
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      ListTile(
                        leading: const Icon(Icons.health_and_safety_outlined),
                        title: Text(l.safetyCenter),
                        trailing: const Icon(
                          Icons.open_in_new_rounded,
                          size: 18,
                        ),
                        onTap: () => openLegal('safety', locale),
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      ListTile(
                        leading: const Icon(Icons.privacy_tip_outlined),
                        title: Text(l.privacyAndData),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => context.push('/me/privacy'),
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
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.description_outlined),
                        title: Text(l.termsOfService),
                        trailing: const Icon(
                          Icons.open_in_new_rounded,
                          size: 18,
                        ),
                        onTap: () => openLegal('terms', locale),
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      ListTile(
                        leading: const Icon(Icons.privacy_tip_outlined),
                        title: Text(l.privacyPolicy),
                        trailing: const Icon(
                          Icons.open_in_new_rounded,
                          size: 18,
                        ),
                        onTap: () => openLegal('privacy', locale),
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      ListTile(
                        leading: const Icon(Icons.business_outlined),
                        title: Text(l.imprint),
                        trailing: const Icon(
                          Icons.open_in_new_rounded,
                          size: 18,
                        ),
                        onTap: () => openLegal('imprint', locale),
                      ),
                      const Divider(height: 1, indent: 16, endIndent: 16),
                      ListTile(
                        leading: Icon(
                          Icons.delete_forever_outlined,
                          color: theme.colorScheme.error,
                        ),
                        title: Text(
                          l.deleteAccount,
                          style: TextStyle(color: theme.colorScheme.error),
                        ),
                        onTap: () => _deleteAccount(context, ref),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: Text(
                    m.email,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                ),
              ],
            ),
            ),
          );
        },
      ),
    );
  }

  // Hesap silme: uyarı + şifre ile onay. Geri alınamaz.
  Future<void> _deleteAccount(BuildContext context, WidgetRef ref) async {
    final l = AppLocalizations.of(context);
    final password = await showDialog<String>(
      context: context,
      builder: (_) => const _DeleteAccountDialog(),
    );
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
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(l.deleteAccountWarning, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          TextField(
            controller: _password,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: InputDecoration(hintText: l.confirmWithPassword),
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(l.cancel),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: error),
          onPressed: _password.text.isEmpty
              ? null
              : () => Navigator.pop(context, _password.text),
          child: Text(l.deleteAccount),
        ),
      ],
    );
  }
}

// Faz 17 madde 7: haftalık özet. Etkinlik yoksa (yeni eşleşme ve mesajlaşma yoksa) hiç gösterilmez —
// her hafta boş bir "0 eşleşme" kartı görmek can sıkıcı olurdu.
class _WeeklyDigestCard extends ConsumerWidget {
  const _WeeklyDigestCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final digest = ref.watch(weeklyDigestProvider).value;
    if (digest == null || !digest.hasActivity) return const SizedBox.shrink();
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Brand.coral.withValues(alpha: 0.14),
          ),
          child: Icon(Icons.insights_rounded, color: Brand.coral),
        ),
        title: Text(
          digest.newMatches > 0 ? l.weeklyDigestMatches(digest.newMatches) : l.weeklyDigestTitle,
          style: theme.textTheme.titleSmall,
        ),
        subtitle: digest.longestChat != null ? Text(l.weeklyDigestLongestChat(digest.longestChat!.otherName)) : null,
      ),
    );
  }
}

class _MeHeader extends StatelessWidget {
  const _MeHeader({
    required this.profile,
    required this.percent,
    required this.verified,
    required this.premiumUntil,
    required this.balance,
    required this.onEdit,
    required this.onWallet,
  });
  final MyProfile? profile;
  final int percent;
  final bool verified;
  final DateTime? premiumUntil;
  final int balance;
  final VoidCallback onEdit;
  final VoidCallback onWallet;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final p = profile;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        color: theme.cardTheme.color,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: premiumUntil != null
              ? [const Color(0xFFFFD86B).withValues(alpha: 0.30), const Color(0xFFD99A0B).withValues(alpha: 0.10)]
              : [Brand.coral.withValues(alpha: 0.12), Brand.orange.withValues(alpha: 0.05)],
        ),
        border: Border.all(color: premiumUntil != null ? const Color(0xFFE9B949) : Brand.coral.withValues(alpha: 0.18), width: premiumUntil != null ? 1.5 : 1),
      ),
      child: Column(children: [
        Row(children: [
          GestureDetector(
            onTap: p == null || p.photos.isEmpty ? onEdit : () => showPhotoViewer(context, p.photos),
            child: SizedBox.square(
              dimension: 84,
              child: Stack(alignment: Alignment.center, children: [
                SizedBox.square(
                  dimension: 84,
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: percent / 100),
                    duration: const Duration(milliseconds: 700),
                    curve: Curves.easeOutCubic,
                    builder: (_, v, _) => CircularProgressIndicator(
                      value: v,
                      strokeWidth: 4,
                      strokeCap: StrokeCap.round,
                      color: premiumUntil != null ? const Color(0xFFE9B949) : Brand.coral,
                      backgroundColor: Brand.coral.withValues(alpha: 0.14),
                    ),
                  ),
                ),
                Avatar(p, radius: 34),
              ]),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (p != null)
                NameWithBadge(
                  '${p.displayName}, ${p.age}',
                  verified: verified,
                  premium: premiumUntil != null,
                  badgeId: p.badgeId,
                  style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: percent / 100,
                  minHeight: 7,
                  color: Brand.coral,
                  backgroundColor: Brand.coral.withValues(alpha: 0.14),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                percent < 100 ? l.profileCompletion(percent) : '%100 ✓',
                style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              if (premiumUntil != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: GestureDetector(
                    onTap: () => context.push('/premium'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: const ShapeDecoration(shape: StadiumBorder(), gradient: premiumGradient),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.workspace_premium_rounded, size: 14, color: Color(0xFF4A3200)),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            '${l.premiumBadgeShort} · ${l.premiumUntilShort(DateFormat.MMMd(l.localeName).format(premiumUntil!))}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Color(0xFF4A3200), fontWeight: FontWeight.w800, fontSize: 11.5),
                          ),
                        ),
                      ]),
                    ),
                  ),
                ),
            ]),
          ),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: GradientButton(label: l.editProfile, icon: Icons.edit_rounded, dense: true, onPressed: onEdit)),
          const SizedBox(width: 10),
          SizedBox(
            height: 44,
            child: OutlinedButton(
              onPressed: onWallet,
              child: AnimatedCoinAmount(balance, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
            ),
          ),
        ]),
      ]),
    );
  }
}

// Faz 22: mağaza girişi — alt menüde yer değiştirdi, profil sayfasında öne çıkarılır
class _StoreEntryCard extends StatelessWidget {
  const _StoreEntryCard({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Material(
      borderRadius: BorderRadius.circular(Brand.radius),
      clipBehavior: Clip.antiAlias,
      color: Colors.transparent,
      child: Ink(
        decoration: BoxDecoration(gradient: Brand.gradient, borderRadius: BorderRadius.circular(Brand.radius)),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(shape: BoxShape.circle, color: Brand.onAccent.withValues(alpha: 0.18)),
                child: Icon(Icons.storefront_rounded, color: Brand.onAccent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(l.navStore, style: TextStyle(color: Brand.onAccent, fontWeight: FontWeight.w900, fontSize: 16)),
                  Text(l.storeEntrySubtitle, style: TextStyle(color: Brand.onAccent.withValues(alpha: 0.85), fontSize: 12.5)),
                ]),
              ),
              Icon(Icons.chevron_right_rounded, color: Brand.onAccent),
            ]),
          ),
        ),
      ),
    );
  }
}

// Faz 20: kompakt hızlı bakış — seri (günlük ödül), yolculuk ilerlemesi, doğrulama durumu.
// Üç kutu da aynı boyutta; günlük ödül alınmadıysa kutuda kırmızı nokta görünür.
class _QuickStats extends ConsumerWidget {
  const _QuickStats({required this.me});
  final Me me;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    const blue = Color(0xFF2F80ED);
    final tiers = AchievementTrack.values.fold<int>(0, (s, t) => s + me.achievements.of(t).tier);
    final maxTiers = AchievementTrack.values.length * 3;
    final status = me.verificationStatus;
    final (vIcon, vValue, vLabel, vActionable) = switch (status) {
      'approved' => (Icons.verified_rounded, l.verifiedLabel, null, false),
      'pending' => (Icons.hourglass_top_rounded, l.verificationPendingLabel, null, false),
      _ => (Icons.verified_outlined, l.verifyProfile, null, true),
    };
    final dailyDot = ref.watch(dailyClaimableProvider).value ?? false;
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(
          child: _StatTile(
            icon: Icons.local_fire_department_rounded,
            color: Brand.orange,
            value: '${me.streak.current}',
            label: l.dailyTitle,
            dot: dailyDot,
            onTap: () => context.push('/daily'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _StatTile(
            icon: Icons.military_tech_rounded,
            color: Brand.gold,
            value: '$tiers/$maxTiers',
            label: l.achievementsTitle,
            onTap: () => context.push('/journey'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _StatTile(
            icon: vIcon,
            color: blue,
            value: vValue,
            label: vLabel,
            compactValue: true,
            onTap: vActionable ? () => context.push('/verify-profile') : null,
          ),
        ),
      ]),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.icon, required this.color, required this.value, required this.label, this.onTap, this.dot = false, this.compactValue = false});
  final IconData icon;
  final Color color;
  final String value;
  final String? label;
  final VoidCallback? onTap;
  final bool dot; // kırmızı nokta (alınmamış ödül)
  final bool compactValue; // değer metin (sayı değil): küçük, iki satıra kadar

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(Brand.radius),
        onTap: onTap,
        child: SizedBox(
          height: 96,
          child: Stack(children: [
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(icon, color: color, size: 22),
                  const SizedBox(height: 4),
                  Text(value,
                      maxLines: compactValue ? 2 : 1,
                      textAlign: TextAlign.center,
                      overflow: TextOverflow.ellipsis,
                      style: (compactValue ? theme.textTheme.labelLarge : theme.textTheme.titleSmall)?.copyWith(fontWeight: FontWeight.w900, height: 1.15)),
                  if (label != null)
                    Text(label!,
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant, fontSize: 11, height: 1.15)),
                ]),
              ),
            ),
            if (dot)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(color: Brand.nope, shape: BoxShape.circle, border: Border.all(color: theme.cardTheme.color ?? Colors.white, width: 1.5)),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}

// Faz 20: gelen sesli/görüntülü arama tercihi. Kapalıyken o türde arama alınmaz; başkalarının
// profilinde arama düğmesi pasif görünür (toplum içindeyken rahatsız edilmeyi önler).
class _CallSettings extends ConsumerStatefulWidget {
  const _CallSettings({required this.me});
  final Me me;

  @override
  ConsumerState<_CallSettings> createState() => _CallSettingsState();
}

class _CallSettingsState extends ConsumerState<_CallSettings> {
  late bool _voice = widget.me.acceptVoiceCalls;
  late bool _video = widget.me.acceptVideoCalls;
  late bool _matchesOnly = widget.me.callsMatchesOnly;

  Future<void> _set({bool? voice, bool? video, bool? matchesOnly}) async {
    final before = (_voice, _video, _matchesOnly);
    setState(() {
      if (voice != null) _voice = voice;
      if (video != null) _video = video;
      if (matchesOnly != null) _matchesOnly = matchesOnly;
    });
    try {
      await ref.read(apiProvider).setCallSettings(voice: voice, video: video, matchesOnly: matchesOnly);
      ref.invalidate(meProvider);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _voice = before.$1;
        _video = before.$2;
        _matchesOnly = before.$3;
      });
      showSnack(context, errorText(AppLocalizations.of(context), e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Column(children: [
      SwitchListTile(
        secondary: Icon(_voice ? Icons.call_rounded : Icons.phone_disabled_rounded),
        title: Text(l.callSettingVoice),
        subtitle: Text(l.callSettingHint),
        value: _voice,
        onChanged: (v) => _set(voice: v),
      ),
      const Divider(height: 1, indent: 16, endIndent: 16),
      SwitchListTile(
        secondary: Icon(_video ? Icons.videocam_rounded : Icons.videocam_off_rounded),
        title: Text(l.callSettingVideo),
        value: _video,
        onChanged: (v) => _set(video: v),
      ),
      const Divider(height: 1, indent: 16, endIndent: 16),
      // İkisi de kapalıysa bu seçenek anlamsız: pasif
      SwitchListTile(
        secondary: const Icon(Icons.people_alt_outlined),
        title: Text(l.callSettingMatchesOnly),
        subtitle: Text(l.callSettingMatchesOnlyHint),
        value: _matchesOnly,
        onChanged: (_voice || _video) ? (v) => _set(matchesOnly: v) : null,
      ),
    ]);
  }
}
