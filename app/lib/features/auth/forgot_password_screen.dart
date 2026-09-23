import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import 'code_field.dart';

// Şifremi unuttum: 1) e-posta gir  2) koda ve yeni şifreye geç. Başarılı olunca giriş yapılır.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  final _password = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    final l = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await action();
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendCode() => _run(() async {
        if (!_email.text.contains('@')) return;
        await Api(null).forgotPassword(_email.text.trim());
        setState(() => _codeSent = true);
      });

  Future<void> _reset() => _run(() async {
        final l = AppLocalizations.of(context);
        if (_code.text.length != 6 || _password.text.length < 8) {
          showSnack(context, _password.text.length < 8 ? l.passwordHint : l.errCodeInvalid);
          return;
        }
        await ref.read(sessionProvider.notifier).resetPassword(_email.text.trim(), _code.text, _password.text);
        if (mounted) showSnack(context, l.resetDone);
      });

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant);

    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(24, 8, 24, 24), children: [
          Text(l.resetTitle, style: theme.textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(_codeSent ? l.codeSentTo(_email.text.trim()) : l.resetHint, style: muted),
          const SizedBox(height: 28),
          if (!_codeSent) ...[
            TextField(
              controller: _email,
              autofocus: true,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              decoration: InputDecoration(hintText: l.email, prefixIcon: const Icon(Icons.mail_outline_rounded)),
              onSubmitted: (_) => _sendCode(),
            ),
            const SizedBox(height: 20),
            GradientButton(label: l.sendCode, busy: _busy, onPressed: _sendCode),
          ] else ...[
            CodeField(controller: _code),
            const SizedBox(height: 14),
            TextField(
              controller: _password,
              obscureText: _obscure,
              autofillHints: const [AutofillHints.newPassword],
              decoration: InputDecoration(
                hintText: l.newPassword,
                helperText: l.passwordHint,
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              onSubmitted: (_) => _reset(),
            ),
            const SizedBox(height: 20),
            GradientButton(label: l.save, busy: _busy, onPressed: _reset),
            TextButton(onPressed: _busy ? null : _sendCode, child: Text(l.resendCode)),
          ],
        ]),
      ),
    );
  }
}
