import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/error_reporter.dart';
import 'core/push.dart';
import 'core/session.dart';
import 'core/theme.dart';
import 'features/call/incoming_calls.dart';
import 'firebase_options.dart';
import 'l10n/app_localizations.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    // Uygulama kapalıyken/arka plandayken gelen arama verisini yakalayıp yerel tam ekran arama
    // arayüzünü gösterir (Faz 15). runApp'ten önce, ana izolede kaydedilmelidir.
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (e) {
    debugPrint('push disabled: $e'); // Firebase ayarlı değil: uygulama bildirimsiz çalışmaya devam eder
  }
  ErrorReporter.install();
  // Otomatik tekrar denemeyi kapat: hatalar ekranda "Yenile" ile yönetiliyor
  runApp(ProviderScope(retry: (_, _) => null, child: const MeetPointApp()));
}

class MeetPointApp extends ConsumerWidget {
  const MeetPointApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(incomingCallsProvider);
    ErrorReporter.auth = ref.watch(sessionProvider.select((s) => s.value?.auth));
    final router = ref.watch(routerProvider);
    ErrorReporter.currentRoute = () => router.routerDelegate.currentConfiguration.uri.path;
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appName,
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      locale: ref.watch(localeProvider),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: router,
    );
  }
}
