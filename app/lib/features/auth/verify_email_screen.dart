import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import 'code_field.dart';

// Kayıttan sonra: e-postaya gelen 6 haneli kodu gir
class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key});

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  static const _cooldown = 60;
  final _code = TextEditingController();
  bool _busy = false;
  int _wait = _cooldown; // kayıtta kod zaten gönderildi
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_wait <= 1) t.cancel();
      if (mounted) setState(() => _wait = (_wait - 1).clamp(0, _cooldown));
    });
  }

  Future<void> _verify() async {
    final l = AppLocalizations.of(context);
    if (_code.text.length != 6 || _busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).verifyEmail(_code.text);
      ref.invalidate(meProvider);
      ref.read(sessionProvider.notifier).emailVerified();
    } catch (e) {
      _code.clear();
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    final l = AppLocalizations.of(context);
    try {
      await ref.read(apiProvider).resendCode();
      if (mounted) showSnack(context, l.codeResent);
      setState(() => _wait = _cooldown);
      _startTimer();
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final email = ref.watch(meProvider).value?.email ?? '';

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          tooltip: l.useAnotherAccount,
          onPressed: () => ref.read(sessionProvider.notifier).logout(),
        ),
      ),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(24, 8, 24, 24), children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(shape: BoxShape.circle, color: Brand.coral.withValues(alpha: 0.12)),
            child: const Icon(Icons.mark_email_unread_outlined, color: Brand.coral, size: 36),
          ),
          const SizedBox(height: 20),
          Text(l.verifyEmailTitle, style: theme.textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(l.codeSentTo(email),
              style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 28),
          CodeField(controller: _code, onCompleted: (_) => _verify()),
          const SizedBox(height: 20),
          GradientButton(label: l.verify, busy: _busy, onPressed: _verify),
          const SizedBox(height: 8),
          Center(
            child: _wait > 0
                ? Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(l.resendIn(_wait), style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
                  )
                : TextButton(onPressed: _resend, child: Text(l.resendCode)),
          ),
        ]),
      ),
    );
  }
}
