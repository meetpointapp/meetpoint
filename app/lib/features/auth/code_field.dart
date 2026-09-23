import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// 6 haneli e-posta kodu girişi: büyük, aralıklı rakamlar; SMS/e-posta otomatik doldurmayı destekler
class CodeField extends StatelessWidget {
  const CodeField({super.key, required this.controller, this.onCompleted, this.autofocus = true});
  final TextEditingController controller;
  final ValueChanged<String>? onCompleted;
  final bool autofocus;

  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        autofocus: autofocus,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        maxLength: 6,
        autofillHints: const [AutofillHints.oneTimeCode],
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: Theme.of(context).textTheme.headlineMedium?.copyWith(letterSpacing: 14, fontWeight: FontWeight.w700),
        decoration: const InputDecoration(counterText: '', hintText: '000000'),
        onChanged: (v) {
          if (v.length == 6) onCompleted?.call(v);
        },
      );
}
