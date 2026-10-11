import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/session.dart';
import 'features/me/notification_settings_screen.dart';
import 'features/me/security_screens.dart';
import 'features/support/support_screens.dart';
import 'features/privacy/privacy_screen.dart';
import 'features/privacy/reconsent_screen.dart';
import 'core/ui.dart';
import 'features/auth/auth_screen.dart';
import 'features/auth/forgot_password_screen.dart';
import 'features/auth/verify_email_screen.dart';
import 'core/models.dart';
import 'features/call/call_history_screen.dart';
import 'features/call/call_screen.dart';
import 'features/verification/verification_screen.dart';
import 'features/chat/chat_screen.dart';
import 'features/chat/conversations_screen.dart';
import 'features/discover/discover_screen.dart';
import 'features/discover/interest_group_screen.dart';
import 'features/store/store_screen.dart';
import 'features/feed/feed_screen.dart';
import 'features/feed/post_screens.dart';
import 'features/feed/stories.dart';
import 'features/home/home_shell.dart';
import 'features/daily/daily_reward_screen.dart';
import 'features/likes/likes_screen.dart';
import 'features/matches/matches_screen.dart';
import 'features/me/me_screen.dart';
import 'features/onboarding/onboarding_screen.dart';
import 'features/profile/profile_edit_screen.dart';
import 'features/profile/vibe_screen.dart';
import 'features/profile/user_profile_screen.dart';
import 'features/requests/requests_screen.dart';
import 'features/me/journey_screen.dart';
import 'features/me/referral_screen.dart';
import 'features/wallet/cashout_screen.dart';
import 'features/wallet/leaderboard_screen.dart';
import 'features/wallet/premium_screen.dart';
import 'features/wallet/wallet_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier(0);
  ref.listen(sessionProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/discover',
    refreshListenable: refresh,
    // Oturum durumuna göre: açılış -> giriş -> profil kurulumu -> ana ekran
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      final loc = state.matchedLocation;
      if (session.isLoading || session.hasError) return loc == '/splash' ? null : '/splash';

      final s = session.requireValue;
      if (!s.isLoggedIn) return const {'/auth', '/forgot-password'}.contains(loc) ? null : '/auth';
      if (!s.emailVerified) return loc == '/verify-email' ? null : '/verify-email';
      // Metinler değiştiyse: onaylanana kadar sadece onay ekranı ve gizlilik/veri hakları ekranı
      if (s.needsLegal) return const {'/consent', '/me/privacy'}.contains(loc) ? null : '/consent';
      if (!s.hasProfile) return loc == '/setup' ? null : '/setup';
      if (const {'/splash', '/auth', '/forgot-password', '/verify-email', '/setup', '/consent'}.contains(loc)) return '/discover';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const _Splash()),
      GoRoute(path: '/auth', builder: (_, _) => const AuthScreen()),
      GoRoute(path: '/forgot-password', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(path: '/verify-email', builder: (_, _) => const VerifyEmailScreen()),
      GoRoute(path: '/verify-profile', builder: (_, _) => const VerificationScreen()),
      GoRoute(path: '/likes', builder: (_, _) => const LikesScreen()),
      GoRoute(path: '/daily', builder: (_, _) => const DailyRewardScreen()),
      GoRoute(path: '/requests', builder: (_, _) => const RequestsScreen()),
      GoRoute(path: '/setup', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/me/edit', builder: (_, _) => const ProfileEditScreen()),
      GoRoute(path: '/me/devices', builder: (_, _) => const DevicesScreen()),
      GoRoute(path: '/me/privacy', builder: (_, _) => const PrivacyScreen()),
      GoRoute(path: '/consent', builder: (_, _) => const ReconsentScreen()),
      GoRoute(path: '/me/password', builder: (_, _) => const ChangePasswordScreen()),
      GoRoute(path: '/me/notifications', builder: (_, _) => const NotificationSettingsScreen()),
      GoRoute(path: '/help', builder: (_, _) => const HelpCenterScreen()),
      GoRoute(path: '/support', builder: (_, _) => const SupportTicketsScreen()),
      GoRoute(path: '/support/new', builder: (_, s) => NewTicketScreen(args: s.extra is NewTicketArgs ? s.extra as NewTicketArgs : null)),
      GoRoute(path: '/support/:id', builder: (_, s) => TicketScreen(ticketId: s.pathParameters['id']!)),
      GoRoute(path: '/user/:id', builder: (_, s) => UserProfileScreen(userId: s.pathParameters['id']!)),
      // Faz 22: sosyal akış
      GoRoute(path: '/user/:id/posts', builder: (_, s) => UserPostsScreen(userId: s.pathParameters['id']!)),
      GoRoute(path: '/user/:id/followers', builder: (_, s) => FollowListScreen(userId: s.pathParameters['id']!, followers: true)),
      GoRoute(path: '/user/:id/following', builder: (_, s) => FollowListScreen(userId: s.pathParameters['id']!, followers: false)),
      GoRoute(path: '/post/:id', builder: (_, s) => PostDetailScreen(postId: s.pathParameters['id']!)),
      GoRoute(
        path: '/stories',
        redirect: (_, state) => state.extra is StoryViewerArgs ? null : '/feed',
        builder: (_, s) => StoryViewerScreen(args: s.extra as StoryViewerArgs),
      ),
      GoRoute(path: '/stories/user/:id', builder: (_, s) => StoryByUserScreen(userId: s.pathParameters['id']!)),
      GoRoute(path: '/story/new', builder: (_, _) => const StoryComposerScreen()),
      GoRoute(path: '/store', builder: (_, _) => const StoreScreen()),
      GoRoute(path: '/matches', builder: (_, _) => const MatchesScreen()),
      GoRoute(path: '/vibe', builder: (_, _) => const VibeQuizScreen()),
      GoRoute(path: '/discover/groups/:interestId', builder: (_, s) => InterestGroupScreen(interestId: s.pathParameters['interestId']!)),
      GoRoute(
        path: '/call/:id',
        builder: (_, s) => CallScreen(callId: s.pathParameters['id']!, initial: s.extra is CallInfo ? s.extra as CallInfo : null),
      ),
      GoRoute(path: '/calls', builder: (_, _) => const CallHistoryScreen()),
      GoRoute(path: '/wallet/cashout', builder: (_, _) => const CashoutScreen()),
      GoRoute(path: '/leaderboard', builder: (_, _) => const LeaderboardScreen()),
      GoRoute(path: '/premium', builder: (_, _) => const PremiumScreen()),
      GoRoute(path: '/journey', builder: (_, _) => const JourneyScreen()),
      GoRoute(path: '/referral', builder: (_, _) => const ReferralScreen()),
      GoRoute(path: '/chat/:id', builder: (_, s) => ChatScreen(conversationId: s.pathParameters['id']!)),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/discover', builder: (_, _) => const DiscoverScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/chats', builder: (_, _) => const ConversationsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/feed', builder: (_, _) => const FeedScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/wallet', builder: (_, _) => const WalletScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/me', builder: (_, _) => const MeScreen())]),
        ],
      ),
    ],
  );
});

// Native açılış ekranıyla (flutter_native_splash) aynı sahne: koyu mürdüm zemin + parıltılı logo.
// Oturum yüklenirken beyaz/pembe flaş yerine kesintisiz bir geçiş sağlar; logo hafifçe nefes alır.
class _Splash extends ConsumerStatefulWidget {
  const _Splash();

  @override
  ConsumerState<_Splash> createState() => _SplashState();
}

class _SplashState extends ConsumerState<_Splash> with SingleTickerProviderStateMixin {
  static const _bg = Color(0xFF160A1F);
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1700))
    ..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    if (session.hasError) {
      // Hata ekranı koyu zeminde okunaklı kalsın
      return Theme(
        data: ThemeData.dark(useMaterial3: true),
        child: Scaffold(
          backgroundColor: _bg,
          body: ErrorRetry(error: session.error!, onRetry: () => ref.invalidate(sessionProvider)),
        ),
      );
    }
    final scale = Tween<double>(begin: 0.97, end: 1.03).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut));
    return Scaffold(
      backgroundColor: _bg,
      body: Stack(children: [
        Center(
          child: ScaleTransition(
            scale: scale,
            child: Image.asset('assets/icon/splash_logo.png', width: 288, height: 288, filterQuality: FilterQuality.medium),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: MediaQuery.paddingOf(context).bottom + 72,
          child: Center(
            child: SizedBox(
              width: 96,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: LinearProgressIndicator(
                  minHeight: 2.5,
                  color: const Color(0xFFFF4D6D),
                  backgroundColor: Colors.white.withValues(alpha: 0.10),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}
