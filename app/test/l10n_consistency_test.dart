import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// Faz 16: metin ve dil denetimi. TR kaynak dosyası (template) ile EN dosyası arasında anahtar
// kümesi birebir aynı olmalı — biri eksikse kullanıcı o ekranda çevrilmemiş/boş metin görür.
// Ayrıca TR ve EN değeri birebir aynıysa (ve markaya/yer tutucuya özgü bir istisna değilse) bu,
// genelde unutulmuş bir çeviriye işaret eder.
const _identicalAllowed = {
  'appName', // marka adı, çevrilmez
  'heightCm', // "{cm} cm": birim evrensel
  'stepOf', // "{step}/{total}": sadece sayı
  'newMessageFrom', // "{name}: {text}": biçim, içerik değil
  'bonusCoins', // "+{count} bonus": "bonus" kelimesi TR'de de kullanılıyor
};

Map<String, dynamic> _readArb(String path) => json.decode(File(path).readAsStringSync()) as Map<String, dynamic>;

void main() {
  final tr = _readArb('lib/l10n/app_tr.arb');
  final en = _readArb('lib/l10n/app_en.arb');
  final trKeys = tr.keys.where((k) => !k.startsWith('@')).toSet();
  final enKeys = en.keys.where((k) => !k.startsWith('@')).toSet();

  test('her TR anahtarının EN karşılığı var', () {
    final missing = trKeys.difference(enKeys);
    expect(missing, isEmpty, reason: 'EN dosyasında eksik: $missing');
  });

  test('her EN anahtarının TR karşılığı var', () {
    final missing = enKeys.difference(trKeys);
    expect(missing, isEmpty, reason: 'TR dosyasında eksik (artık kullanılmıyor olabilir): $missing');
  });

  test('TR ve EN metinleri beklenmedik şekilde aynı değil (unutulmuş çeviri olabilir)', () {
    final identical = <String>[];
    for (final k in trKeys.intersection(enKeys)) {
      final tv = tr[k];
      final ev = en[k];
      if (tv is String && ev is String && tv == ev && tv.trim().isNotEmpty && !_identicalAllowed.contains(k)) {
        identical.add(k);
      }
    }
    expect(identical, isEmpty,
        reason: 'TR ve EN aynı: $identical — kasıtlıysa _identicalAllowed listesine ekle');
  });

  test('_identicalAllowed listesi güncel (artık aynı olmayan anahtar kalmamış)', () {
    final stillIdentical = _identicalAllowed.where((k) => tr[k] != null && tr[k] == en[k]);
    expect(stillIdentical.length, _identicalAllowed.length,
        reason: 'Listede olup artık TR/EN\'de farklı olan anahtarlar var; listeden çıkar');
  });
}
