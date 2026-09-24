import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/app_localizations.dart';
import 'api.dart';
import 'config.dart';
import 'models.dart';
import 'theme.dart';

String errorText(AppLocalizations l, Object error) {
  if (error is! ApiException) return l.errGeneric;
  return switch (error.code) {
    'network' => l.errNetwork,
    'invalid_credentials' => l.errInvalidCredentials,
    'email_taken' => l.errEmailTaken,
    'underage' => l.errUnderage,
    'insufficient_balance' => l.errInsufficientBalance,
    'request_already_pending' => l.errAlreadyPending,
    'already_in_conversation' => l.errAlreadyInConversation,
    'too_many_photos' => l.errTooManyPhotos,
    'validation' => l.errValidation,
    'request_expired' => l.errExpired,
    'request_not_pending' => l.errNotPending,
    'blocked' => l.errBlocked,
    'code_invalid' => l.errCodeInvalid,
    'code_expired' => l.errCodeExpired,
    'code_cooldown' => l.errCodeCooldown,
    'rate_limited' => l.errRateLimited,
    'banned' => l.errBanned,
    'already_verified' => l.errAlreadyVerified,
    'verification_pending' => l.errVerificationPending,
    'already_boosted' => l.errAlreadyBoosted,
    'already_viewed' => l.errAlreadyViewed,
    'busy' => l.errBusy,
    'already_in_call' => l.errAlreadyInCall,
    'call_not_ringing' || 'call_not_active' => l.errCallGone,
    'not_found' => l.errNotFound,
    'caller_insufficient_balance' => l.errCallerBalance,
    'verification_required' => l.errVerificationRequired,
    'below_minimum' => l.errBelowMinimum,
    'insufficient_cashable' => l.errInsufficientCashable,
    'invalid_iban' => l.errInvalidIban,
    'account_name_required' => l.errAccountNameRequired,
    'payout_pending' => l.errPayoutPending,
    'request_in_progress' => l.errRequestInProgress,
    'payout_not_pending' => l.errPayoutProcessed,
    'invalid_image' => l.errInvalidImage,
    'already_rated' => l.errAlreadyRated,
    'store_unavailable' => l.errStoreUnavailable,
    'call_not_ended' || 'invalid_gift' => l.errCallGone,
    'password_too_common' => l.errPasswordTooCommon,
    'password_breached' => l.errPasswordBreached,
    'password_same' => l.errPasswordSame,
    'account_locked' => l.errAccountLocked,
    'too_many_accounts' => l.errTooManyAccounts,
    'captcha_required' || 'captcha_failed' || 'captcha_unavailable' => l.errCaptcha,
    'refresh_race' => l.errRequestInProgress,
    'consent_required' => l.errConsentRequired,
    'restricted' => l.errRestricted,
    'already_appealed' => l.errAlreadyAppealed,
    'peer_calls_disabled' => l.errPeerCallsDisabled,
    'export_cooldown' => l.errExportCooldown,
    'export_unavailable' => l.errNotFound,
    'already_answered' => l.errGeneric,
    _ => l.errGeneric,
  };
}

// Yasal belgeyi (kullanım koşulları / gizlilik) kullanıcının dilinde tarayıcıda aç
Future<void> openLegal(String doc, String locale) =>
    launchUrl(Uri.parse('$apiBaseUrl/legal/$doc?lang=$locale'), mode: LaunchMode.externalApplication);

// Mavi tik rozeti (isim yanında)
class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({super.key, this.size = 18, this.onPhoto = false});
  final double size;
  final bool onPhoto;

  @override
  Widget build(BuildContext context) => Tooltip(
        message: AppLocalizations.of(context).verifiedLabel,
        child: Icon(
          Icons.verified_rounded,
          size: size,
          color: const Color(0xFF2F80ED),
          shadows: onPhoto ? const [Shadow(color: Colors.black38, blurRadius: 6)] : null,
        ),
      );
}

// İsim + (varsa) mavi tik
class NameWithBadge extends StatelessWidget {
  const NameWithBadge(this.text, {super.key, required this.verified, this.style, this.onPhoto = false});
  final String text;
  final bool verified;
  final TextStyle? style;
  final bool onPhoto;

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Flexible(child: Text(text, style: style, overflow: TextOverflow.ellipsis)),
        if (verified) ...[
          const SizedBox(width: 6),
          VerifiedBadge(size: (style?.fontSize ?? 16) * 0.9, onPhoto: onPhoto),
        ],
      ]);
}

void showSnack(BuildContext context, String text, {SnackBarAction? action}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text), action: action));
}

String requestKindLabel(AppLocalizations l, RequestKind k) => switch (k) {
      RequestKind.message => l.messageRequest,
      RequestKind.voice => l.voiceCall,
      RequestKind.video => l.videoCall,
    };

IconData requestKindIcon(RequestKind k) => switch (k) {
      RequestKind.message => Icons.mail_outline_rounded,
      RequestKind.voice => Icons.call_rounded,
      RequestKind.video => Icons.videocam_rounded,
    };

class NetPhoto extends StatelessWidget {
  const NetPhoto(this.url, {super.key, this.fit = BoxFit.cover});
  final String? url;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Icon(Icons.person_rounded, size: 48, color: Theme.of(context).colorScheme.outline),
    );
    if (url == null) return placeholder;
    return CachedNetworkImage(
      imageUrl: mediaUrl(url!),
      fit: fit,
      placeholder: (_, _) => placeholder,
      errorWidget: (_, _, _) => placeholder,
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar(this.profile, {super.key, this.radius = 24});
  final PublicProfile? profile;
  final double radius;

  @override
  Widget build(BuildContext context) => ClipOval(
        child: SizedBox.square(dimension: radius * 2, child: NetPhoto(profile?.coverThumbUrl)),
      );
}

class CoinAmount extends StatelessWidget {
  const CoinAmount(this.amount, {super.key, this.style, this.signed = false});
  final int amount;
  final TextStyle? style;
  final bool signed;

  @override
  Widget build(BuildContext context) {
    final text = signed && amount > 0 ? '+$amount' : '$amount';
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.toll_rounded, size: (style?.fontSize ?? 14) + 2, color: Brand.gold),
      const SizedBox(width: 4),
      Text(text, style: style),
    ]);
  }
}

// Boş durum: gradyan halka içinde simge + kısa açıklama
class CenteredMessage extends StatelessWidget {
  const CenteredMessage({super.key, required this.icon, required this.text, this.action});
  final IconData icon;
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [Brand.coral.withValues(alpha: 0.16), Brand.orange.withValues(alpha: 0.16)],
                ),
              ),
              child: Icon(icon, size: 40, color: Brand.coral),
            ),
            const SizedBox(height: 18),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 280),
              child: Text(
                text,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
            if (action != null) ...[const SizedBox(height: 18), action!],
          ]),
        ),
      );
}

// Yükleniyor iskeleti: yumuşak nabız efektiyle yanıp sönen gri kutular
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, required this.child});
  final Widget child;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
    ..repeat(reverse: true);

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
        opacity: Tween(begin: 0.45, end: 1.0).animate(CurvedAnimation(parent: _anim, curve: Curves.easeInOut)),
        child: widget.child,
      );
}

class SkeletonBox extends StatelessWidget {
  const SkeletonBox({super.key, this.width, this.height = 14, this.radius = 8, this.circle = false});
  final double? width;
  final double height;
  final double radius;
  final bool circle;

  @override
  Widget build(BuildContext context) => Container(
        width: circle ? height : width,
        height: height,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: circle ? null : BorderRadius.circular(radius),
          shape: circle ? BoxShape.circle : BoxShape.rectangle,
        ),
      );
}

// Liste ekranları için satır iskeleti (sohbetler, istekler)
class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key, this.rows = 6});
  final int rows;

  @override
  Widget build(BuildContext context) => Skeleton(
        child: ListView.builder(
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          itemCount: rows,
          itemBuilder: (_, _) => const Padding(
            padding: EdgeInsets.only(bottom: 18),
            child: Row(children: [
              SkeletonBox(height: 52, circle: true),
              SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SkeletonBox(width: 120, height: 14),
                  SizedBox(height: 8),
                  SkeletonBox(width: 200, height: 12),
                ]),
              ),
            ]),
          ),
        ),
      );
}

class ProfileSkeleton extends StatelessWidget {
  const ProfileSkeleton({super.key});

  @override
  Widget build(BuildContext context) => Skeleton(
        child: ListView(physics: const NeverScrollableScrollPhysics(), children: [
          SkeletonBox(height: MediaQuery.sizeOf(context).width * 1.15, radius: 0),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                SkeletonBox(width: 90, height: 28, radius: 14),
                SizedBox(width: 8),
                SkeletonBox(width: 70, height: 28, radius: 14),
                SizedBox(width: 8),
                SkeletonBox(width: 110, height: 28, radius: 14),
              ]),
              SizedBox(height: 16),
              SkeletonBox(height: 110, radius: 16),
            ]),
          ),
        ]),
      );
}

// AsyncValue için ortak yükleniyor/hata görünümü
class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return CenteredMessage(
      icon: Icons.cloud_off_rounded,
      text: errorText(l, error),
      action: FilledButton.tonal(onPressed: onRetry, child: Text(l.refresh)),
    );
  }
}
