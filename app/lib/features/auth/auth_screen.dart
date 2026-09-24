import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import '../privacy/consent_widgets.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _registerMode = false;
  bool _busy = false;
  bool _obscure = true;
  bool _acceptedTerms = false;
  bool _overseas = false;
  bool _marketing = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (_registerMode && !_acceptedTerms) {
      showSnack(context, AppLocalizations.of(context).mustAcceptTerms);
      return;
    }
    setState(() => _busy = true);
    final session = ref.read(sessionProvider.notifier);
    try {
      if (_registerMode) {
        await session.register(_email.text.trim(), _password.text, ref.read(localeProvider).languageCode,
            overseas: _overseas, marketing: _marketing);
      } else {
        final restored = await session.login(_email.text.trim(), _password.text);
        if (restored && mounted) showSnack(context, AppLocalizations.of(context).accountRestored);
      }
    } catch (e) {
      if (mounted) showSnack(context, errorText(AppLocalizations.of(context), e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: Brand.gradient),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: const Icon(Icons.favorite_rounded, size: 40, color: Colors.white),
                  ),
                  const SizedBox(height: 14),
                  const BrandLogo(size: 36, light: true),
                  const SizedBox(height: 4),
                  Text(l.tagline, style: theme.textTheme.titleMedium?.copyWith(color: Colors.white.withValues(alpha: 0.85))),
                  const SizedBox(height: 32),
                  if (ref.watch(sessionProvider).value?.notice == 'banned')
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Brand.radius)),
                      child: Row(children: [
                        Icon(Icons.block_rounded, color: theme.colorScheme.error),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(l.errBanned, style: TextStyle(color: theme.colorScheme.error, fontWeight: FontWeight.w600)),
                        ),
                      ]),
                    ),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(22),
                      child: Form(
                        key: _form,
                        child: AutofillGroup(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                            AnimatedSwitcher(
                              duration: const Duration(milliseconds: 200),
                              child: Text(
                                _registerMode ? l.registerTitle : l.loginTitle,
                                key: ValueKey(_registerMode),
                                style: theme.textTheme.headlineSmall,
                              ),
                            ),
                            const SizedBox(height: 18),
                            TextFormField(
                              controller: _email,
                              keyboardType: TextInputType.emailAddress,
                              autofillHints: const [AutofillHints.email],
                              decoration: InputDecoration(hintText: l.email, prefixIcon: const Icon(Icons.mail_outline_rounded)),
                              validator: (v) => (v == null || !v.contains('@')) ? l.requiredField : null,
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _password,
                              obscureText: _obscure,
                              autofillHints: [_registerMode ? AutofillHints.newPassword : AutofillHints.password],
                              decoration: InputDecoration(
                                hintText: l.password,
                                helperText: _registerMode ? l.passwordHint : null,
                                prefixIcon: const Icon(Icons.lock_outline_rounded),
                                suffixIcon: IconButton(
                                  icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                                  onPressed: () => setState(() => _obscure = !_obscure),
                                ),
                              ),
                              validator: (v) => (v == null || v.length < 8) ? l.passwordHint : null,
                              onFieldSubmitted: (_) => _submit(),
                            ),
                            if (_registerMode) ...[
                              const SizedBox(height: 8),
                              _TermsConsent(
                                value: _acceptedTerms,
                                onChanged: (v) => setState(() => _acceptedTerms = v),
                              ),
                              // İsteğe bağlı açık rızalar: ayrı kutucuk, varsayılan işaretsiz
                              ConsentCheckbox(
                                kind: ConsentKind.overseasTransfer,
                                text: l.consentOverseasRegister,
                                value: _overseas,
                                onChanged: (v) => setState(() => _overseas = v),
                              ),
                              ConsentCheckbox(
                                kind: ConsentKind.marketing,
                                text: l.consentMarketingRegister,
                                value: _marketing,
                                onChanged: (v) => setState(() => _marketing = v),
                              ),
                            ] else
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed: _busy ? null : () => context.push('/forgot-password'),
                                  child: Text(l.forgotPassword),
                                ),
                              ),
                            const SizedBox(height: 12),
                            GradientButton(
                              label: _registerMode ? l.register : l.login,
                              busy: _busy,
                              onPressed: _submit,
                            ),
                            const SizedBox(height: 4),
                            TextButton(
                              onPressed: _busy ? null : () => setState(() => _registerMode = !_registerMode),
                              child: Text(_registerMode ? l.haveAccount : l.noAccount),
                            ),
                          ]),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const _LanguageToggle(),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// "18 yaşından büyüğüm; Kullanım Koşulları ve Gizlilik Politikası'nı kabul ediyorum" onay kutusu.
// Bağlantılar cümlenin içinde tıklanabilir.
class _TermsConsent extends ConsumerStatefulWidget {
  const _TermsConsent({required this.value, required this.onChanged});
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  ConsumerState<_TermsConsent> createState() => _TermsConsentState();
}

class _TermsConsentState extends ConsumerState<_TermsConsent> {
  late final _terms = TapGestureRecognizer();
  late final _privacy = TapGestureRecognizer();

  @override
  void dispose() {
    _terms.dispose();
    _privacy.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final locale = ref.watch(localeProvider).languageCode;
    _terms.onTap = () => openLegal('terms', locale);
    _privacy.onTap = () => openLegal('privacy', locale);

    // Çeviri cümlesindeki yer tutucuları işaretçiyle değiştirip bağlantı parçalarına böl
    const t = '\u0001', p = '\u0002';
    final sentence = l.termsConsent(t, p);
    final spans = <InlineSpan>[];
    final link = TextStyle(color: Brand.coral, fontWeight: FontWeight.w600, decoration: TextDecoration.underline);
    var rest = sentence;
    while (rest.isNotEmpty) {
      final i = rest.indexOf(RegExp('[$t$p]'));
      if (i < 0) {
        spans.add(TextSpan(text: rest));
        break;
      }
      if (i > 0) spans.add(TextSpan(text: rest.substring(0, i)));
      final isTerms = rest[i] == t;
      spans.add(TextSpan(
        text: isTerms ? l.termsOfService : l.privacyPolicy,
        style: link,
        recognizer: isTerms ? _terms : _privacy,
      ));
      rest = rest.substring(i + 1);
    }

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => widget.onChanged(!widget.value),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Checkbox(value: widget.value, onChanged: (v) => widget.onChanged(v ?? false)),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 12, right: 4),
            child: Text.rich(TextSpan(children: spans), style: Theme.of(context).textTheme.bodySmall),
          ),
        ),
      ]),
    );
  }
}

class _LanguageToggle extends ConsumerWidget {
  const _LanguageToggle();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(localeProvider).languageCode;
    // Sabit genişlik: yazı tipi geç yüklendiğinde etiketlerin iki satıra bölünmesini önler
    return SizedBox(
      width: 260,
      child: SegmentedButton<String>(
        showSelectedIcon: false,
        expandedInsets: EdgeInsets.zero,
        style: SegmentedButton.styleFrom(
          foregroundColor: Colors.white,
          selectedForegroundColor: Brand.coral,
          selectedBackgroundColor: Colors.white,
          side: const BorderSide(color: Colors.white70),
        ),
        segments: const [
          ButtonSegment(value: 'tr', label: Text('Türkçe', maxLines: 1, softWrap: false)),
          ButtonSegment(value: 'en', label: Text('English', maxLines: 1, softWrap: false)),
        ],
        selected: {current},
        onSelectionChanged: (s) => ref.read(localeProvider.notifier).set(s.first),
      ),
    );
  }
}
