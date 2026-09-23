import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/error_reporter.dart';
import 'core/session.dart';
import 'core/theme.dart';
import 'features/call/incoming_calls.dart';
import 'l10n/app_localizations.dart';
import 'router.dart';

void main() {
  ErrorReporter.install();
  // Otomatik tekrar denemeyi kapat: hatalar ekranda "Yenile" ile yönetiliyor
  runApp(ProviderScope(retry: (_, _) => null, child: const MeetPointApp()));
}

class MeetPointApp extends ConsumerWidget {
  const MeetPointApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(incomingCallsProvider);
    ErrorReporter.token = ref.watch(sessionProvider.select((s) => s.value?.token));
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
