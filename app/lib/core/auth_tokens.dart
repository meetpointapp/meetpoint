import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';

// Oturum jetonları: kısa ömürlü erişim jetonu (15 dk) + her kullanımda değişen yenileme jetonu.
// Aynı nesne oturum boyunca yaşar; yenilemede içi güncellenir, böylece Api ve anlık bağlantı
// her yenilemede baştan kurulmaz.
class AuthTokens {
  AuthTokens(this._access, this._refresh, {this.onChanged});

  String _access;
  String _refresh;
  // Yeni jetonlar kalıcı depoya yazılır
  final Future<void> Function(AuthTokens tokens)? onChanged;
  Future<void>? _refreshing;

  String get access => _access;
  String get refreshToken => _refresh;

  // Erişim jetonunun bitişine bu kadar kala önceden yenilenir (saat kaymasına pay)
  static const _margin = Duration(seconds: 60);

  DateTime? get _expiresAt {
    try {
      final part = _access.split('.')[1];
      final payload = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(part)))) as Map;
      final exp = payload['exp'];
      return exp is int ? DateTime.fromMillisecondsSinceEpoch(exp * 1000) : null;
    } catch (_) {
      return null;
    }
  }

  bool get expiresSoon {
    final at = _expiresAt;
    return at != null && DateTime.now().add(_margin).isAfter(at);
  }

  // Tek seferde tek yenileme: aynı anda süresi dolan istekler aynı yenilemeyi bekler.
  // [call] yenileme jetonunu sunucuya gönderip yeni çifti döndürür.
  Future<void> refresh(Future<({String token, String refreshToken})> Function(String refreshToken) call) {
    return _refreshing ??= () async {
      try {
        final next = await call(_refresh);
        _access = next.token;
        _refresh = next.refreshToken;
        await onChanged?.call(this);
      } finally {
        _refreshing = null;
      }
    }();
  }

  @visibleForTesting
  static AuthTokens fixed(String access) => AuthTokens(access, 'refresh');
}

// Bu kurulumun kalıcı kimliği (yeni cihaz uyarısı ve cihaz başına hesap sınırı için)
String newDeviceId() {
  final r = Random.secure();
  return List.generate(16, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
}

String get platformName => kIsWeb
    ? 'web'
    : switch (defaultTargetPlatform) {
        TargetPlatform.iOS => 'ios',
        TargetPlatform.android => 'android',
        _ => defaultTargetPlatform.name,
      };

String get deviceLabel => kIsWeb
    ? 'Web'
    : switch (defaultTargetPlatform) {
        TargetPlatform.iOS => 'iPhone',
        TargetPlatform.android => 'Android',
        TargetPlatform.windows => 'Windows',
        TargetPlatform.macOS => 'Mac',
        _ => defaultTargetPlatform.name,
      };
