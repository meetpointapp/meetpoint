import 'package:flutter/foundation.dart';

// Sunucu adresi. Gerçek cihazda test ederken:
//   flutter run --dart-define=API_URL=http://<bilgisayar-ip>:4000
const _apiOverride = String.fromEnvironment('API_URL');

String get apiBaseUrl {
  if (_apiOverride.isNotEmpty) return _apiOverride;
  // Android emülatöründe bilgisayarın localhost'u 10.0.2.2'dir
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

String mediaUrl(String path) => path.startsWith('http') ? path : '$apiBaseUrl$path';

const maxPhotos = 6;

// Hata raporlarında görünür; pubspec'teki sürümle aynı tutulmalı
const appVersion = String.fromEnvironment('APP_VERSION', defaultValue: '1.0.0');
