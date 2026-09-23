import 'package:flutter/services.dart';

// Arama süresi: 04:07 veya 1:02:03
String formatCallTime(Duration d) {
  final m = (d.inMinutes % 60).toString().padLeft(2, '0');
  final s = (d.inSeconds % 60).toString().padLeft(2, '0');
  return d.inHours > 0 ? '${d.inHours}:$m:$s' : '$m:$s';
}

// IBAN'ı yazarken 4'erli gruplar halinde ve büyük harfle gösterir (en fazla 34 karakter)
class IbanInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final raw = newValue.text.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();
    final clipped = raw.length > 34 ? raw.substring(0, 34) : raw;
    final grouped = RegExp(r'.{1,4}').allMatches(clipped).map((m) => m.group(0)).join(' ');
    return TextEditingValue(text: grouped, selection: TextSelection.collapsed(offset: grouped.length));
  }
}
