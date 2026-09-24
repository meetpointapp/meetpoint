import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/session.dart';
import 'features/me/security_screens.dart';
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
import 'features/home/home_shell.dart';
import 'features/likes/likes_screen.dart';
import 'features/me/me_screen.dart';
import 'features/onboarding/onboarding_screen.dart';
import 'features/profile/profile_edit_screen.dart';
import 'features/profile/user_profile_screen.dart';
import 'features/requests/requests_screen.dart';
import 'features/wallet/cashout_screen.dart';
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
      if (!s.hasProfile) return loc == '/setup' ? null : '/setup';
      if (const {'/splash', '/auth', '/forgot-password', '/verify-email', '/setup'}.contains(loc)) return '/discover';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const _Splash()),
      GoRoute(path: '/auth', builder: (_, _) => const AuthScreen()),
      GoRoute(path: '/forgot-password', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(path: '/verify-email', builder: (_, _) => const VerifyEmailScreen()),
      GoRoute(path: '/verify-profile', builder: (_, _) => const VerificationScreen()),
      GoRoute(path: '/likes', builder: (_, _) => const LikesScreen()),
      GoRoute(path: '/setup', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/me/edit', builder: (_, _) => const ProfileEditScreen()),
      GoRoute(path: '/me/devices', builder: (_, _) => const DevicesScreen()),
      GoRoute(path: '/me/password', builder: (_, _) => const ChangePasswordScreen()),
      GoRoute(path: '/user/:id', builder: (_, s) => UserProfileScreen(userId: s.pathParameters['id']!)),
      GoRoute(
        path: '/call/:id',
        builder: (_, s) => CallScreen(callId: s.pathParameters['id']!, initial: s.extra is CallInfo ? s.extra as CallInfo : null),
      ),
      GoRoute(path: '/calls', builder: (_, _) => const CallHistoryScreen()),
      GoRoute(path: '/wallet/cashout', builder: (_, _) => const CashoutScreen()),
      GoRoute(path: '/chat/:id', builder: (_, s) => ChatScreen(conversationId: s.pathParameters['id']!)),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/discover', builder: (_, _) => const DiscoverScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/requests', builder: (_, _) => const RequestsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/chats', builder: (_, _) => const ConversationsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/wallet', builder: (_, _) => const WalletScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/me', builder: (_, _) => const MeScreen())]),
        ],
      ),
    ],
  );
});

class _Splash extends ConsumerWidget {
  const _Splash();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return Scaffold(
      body: session.hasError
          ? ErrorRetry(error: session.error!, onRetry: () => ref.invalidate(sessionProvider))
          : const Center(child: CircularProgressIndicator()),
    );
  }
}
