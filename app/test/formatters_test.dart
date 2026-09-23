import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:meetpoint/core/formatters.dart';

TextEditingValue _type(TextInputFormatter f, String text) =>
    f.formatEditUpdate(TextEditingValue.empty, TextEditingValue(text: text));

void main() {
  group('formatCallTime', () {
    test('dakika ve saniye', () {
      expect(formatCallTime(Duration.zero), '00:00');
      expect(formatCallTime(const Duration(seconds: 7)), '00:07');
      expect(formatCallTime(const Duration(minutes: 4, seconds: 7)), '04:07');
    });

    test('bir saati aşan aramada dakika 60\'ı geçmez', () {
      expect(formatCallTime(const Duration(hours: 1, minutes: 2, seconds: 3)), '1:02:03');
      expect(formatCallTime(const Duration(minutes: 125)), '2:05:00');
    });
  });

  group('IbanInputFormatter', () {
    final f = IbanInputFormatter();

    test('4\'erli gruplar ve büyük harf', () {
      expect(_type(f, 'tr330006100519786457841326').text, 'TR33 0006 1005 1978 6457 8413 26');
    });

    test('boşluk ve işaretler atılır', () {
      expect(_type(f, 'TR33-0006 1005.1978').text, 'TR33 0006 1005 1978');
    });

    test('en fazla 34 karakter', () {
      final out = _type(f, 'A' * 40).text.replaceAll(' ', '');
      expect(out.length, 34);
    });

    test('imleç her zaman sonda', () {
      final v = _type(f, 'tr33');
      expect(v.selection.baseOffset, v.text.length);
    });
  });
}
