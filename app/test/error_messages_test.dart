import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:meetpoint/core/api.dart';
import 'package:meetpoint/core/ui.dart';
import 'package:meetpoint/l10n/app_localizations.dart';

// Sunucunun döndürebileceği her hata kodunun uygulamada anlaşılır bir mesajı olmalı.
// Yeni bir hata kodu eklenince bu test, ya mesaj eklenmesini ya da aşağıdaki listeye
// (kullanıcıya hiç ulaşmayan kodlar) bilinçli olarak eklenmesini zorunlu kılar.
const internalCodes = {
  'email_not_verified': 'yönlendirici e-posta doğrulama ekranına götürür',
  'profile_required': 'yönlendirici profil kurulumuna götürür',
  'invalid_token': 'oturum geçersiz: giriş ekranına dönülür',
  'unauthorized': 'oturum yok: giriş ekranına dönülür',
  'forbidden': 'sadece yönetim paneli',
  'invalid_order': 'fotoğraf sıralama isteği uygulama tarafından doğru üretilir',
  'invalid_pack': 'paket listesi sunucudan gelir',
  'invalid_target': 'arayüz kişinin kendisine işlem sunmaz',
  'note_required': 'gönder butonu boş notta kapalı',
  'store_not_configured': 'sadece geliştirme ortamı',
  'verification_not_started': 'selfie ekranı önce doğrulamayı başlatır',
  'view_once_sender': 'gönderen kendi fotoğrafını açma seçeneği görmez',
  'invalid_idempotency_key': 'anahtarı uygulama doğru biçimde üretir (Api.newIdempotencyKey)',
  'idempotency_key_reused': 'her yeni eylem yeni anahtar alır; aynı anahtar sadece aynı isteğin tekrarında kullanılır',
  'token_expired': 'Api jetonu yenileyip isteği kendiliğinden tekrarlar',
  'invalid_refresh': 'oturum kapanmış: giriş ekranına dönülür',
  'mfa_setup_required': 'sadece yönetim paneli',
  'mfa_required': 'sadece yönetim paneli',
  'mfa_already_enabled': 'sadece yönetim paneli',
  'mfa_setup_not_started': 'sadece yönetim paneli',
  'mfa_invalid': 'sadece yönetim paneli',
  'mfa_code_used': 'sadece yönetim paneli',
  'cannot_ban_self': 'sadece yönetim paneli',
  'cannot_change_own_role': 'sadece yönetim paneli',
  'cannot_reset_own_mfa': 'sadece yönetim paneli',
  'reconsent_required': 'yönlendirici yeniden onay ekranına götürür',
  'already_answered': 'sadece yönetim paneli',
  'already_resolved': 'sadece yönetim paneli',
  'cannot_sanction_staff': 'sadece yönetim paneli',
  'rate_required': 'sadece yönetim paneli (EFT kuru)',
};

Set<String> _serverCodes() {
  final src = Directory('../server/src');
  final codes = <String>{};
  final re = RegExp(r"HttpError\(\d+, '([a-z_]+)'\)");
  for (final f in src.listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.ts'))) {
    codes.addAll(re.allMatches(f.readAsStringSync()).map((m) => m.group(1)!));
  }
  return codes;
}

void main() {
  final codes = _serverCodes();

  test('sunucu kaynakları okunabildi', () {
    expect(codes.length, greaterThan(30));
  });

  for (final locale in const [Locale('tr'), Locale('en')]) {
    final l = lookupAppLocalizations(locale);

    test('${locale.languageCode}: kullanıcıya ulaşabilen her kodun mesajı var', () {
      final missing = [
        for (final c in codes)
          if (!internalCodes.containsKey(c) && errorText(l, ApiException(c)) == l.errGeneric) c,
      ];
      expect(missing, isEmpty, reason: 'Mesajı olmayan kodlar: $missing');
    });

    test('${locale.languageCode}: sunucu dışı hatalar', () {
      expect(errorText(l, const ApiException('network')), l.errNetwork);
      expect(errorText(l, const ApiException('rate_limited')), l.errRateLimited);
      expect(errorText(l, const ApiException('validation')), l.errValidation);
      expect(errorText(l, StateError('x')), l.errGeneric);
    });
  }

  test('iç kodlar listesi güncel (artık kullanılmayan kod kalmamış)', () {
    expect(internalCodes.keys.where((c) => !codes.contains(c)), isEmpty);
  });
}
