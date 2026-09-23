import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'config.dart';

// Yakalanmamış hataları sunucuya bildirir (yönetim paneli → Hatalar).
// Geliştirme modunda sadece konsola yazar; aynı hata kısa sürede tekrar gönderilmez.
class ErrorReporter {
  ErrorReporter._();

  static String? token; // oturum açıksa hata kullanıcıyla eşleşir
  static String Function()? currentRoute;

  static final _dio = Dio(BaseOptions(baseUrl: apiBaseUrl, connectTimeout: const Duration(seconds: 5)));
  static final Map<String, DateTime> _recent = {};

  static String get _platform => kIsWeb
      ? 'web'
      : switch (defaultTargetPlatform) {
          TargetPlatform.iOS => 'ios',
          TargetPlatform.android => 'android',
          _ => defaultTargetPlatform.name,
        };

  static void install() {
    final previous = FlutterError.onError;
    FlutterError.onError = (details) {
      previous?.call(details);
      report(details.exception, details.stack);
    };
    PlatformDispatcher.instance.onError = (error, stack) {
      report(error, stack);
      return true;
    };
  }

  static Future<void> report(Object error, StackTrace? stack) async {
    if (kDebugMode) return;
    final message = error.toString();
    // Aynı hata dakikada bir kez
    final now = DateTime.now();
    final last = _recent[message];
    if (last != null && now.difference(last) < const Duration(minutes: 1)) return;
    _recent[message] = now;
    if (_recent.length > 50) _recent.remove(_recent.keys.first);

    String route = '';
    try {
      route = currentRoute?.call() ?? '';
    } catch (_) {}
    try {
      await _dio.post(
        '/client-errors',
        data: {
          'message': message.length > 2000 ? message.substring(0, 2000) : message,
          'stack': (stack ?? StackTrace.empty).toString(),
          'platform': _platform,
          'appVersion': appVersion,
          'context': route,
        },
        options: Options(headers: {if (token != null) 'Authorization': 'Bearer $token'}),
      );
    } catch (_) {
      // Bildirim başarısız olursa sessizce geç: hata raporu uygulamayı bozmamalı
    }
  }
}
