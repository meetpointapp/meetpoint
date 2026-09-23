import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/catalog.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import '../profile/profile_fields.dart';

// Kayıt sonrası adım adım profil oluşturma: her ekranda tek soru.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _Step {
  const _Step({required this.title, this.hint, required this.content, required this.valid, this.optional = false});
  final String title;
  final String? hint;
  final Widget content;
  final bool valid;
  final bool optional;
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _draft = ProfileDraft();
  int _index = 0;
  bool _saving = false;

  void _changed() => setState(() {});

  List<_Step> _steps(AppLocalizations l) => [
        _Step(
          title: l.obNameTitle,
          hint: l.obNameHint,
          content: NameField(draft: _draft, onChanged: _changed, onSubmitted: _next),
          valid: _draft.displayName.trim().length >= 2,
        ),
        _Step(
          title: l.obBirthTitle,
          hint: l.obBirthHint,
          content: BirthDateField(draft: _draft, onChanged: _changed),
          valid: _draft.birthDate != null && ageFrom(_draft.birthDate!) >= 18,
        ),
        _Step(
          title: l.obGenderTitle,
          content: ChoiceTiles(
            options: genderOptions(l),
            selected: _draft.gender,
            onSelected: (v) => setState(() => _draft.gender = v),
          ),
          valid: _draft.gender.isNotEmpty,
        ),
        _Step(
          title: l.obInterestedTitle,
          content: ChoiceTiles(
            options: interestedInOptions(l),
            selected: _draft.interestedIn,
            onSelected: (v) => setState(() => _draft.interestedIn = v),
          ),
          valid: _draft.interestedIn.isNotEmpty,
        ),
        _Step(
          title: l.obPhotosTitle,
          hint: l.obPhotosHint,
          content: PhotoGridField(draft: _draft, onChanged: _changed),
          valid: _draft.photos.isNotEmpty,
        ),
        _Step(
          title: l.obInterestsTitle,
          hint: '${l.obInterestsHint(minInterests, maxInterests)} · ${_draft.interests.length}/$maxInterests',
          content: InterestPicker(draft: _draft, onChanged: _changed),
          valid: _draft.interests.length >= minInterests,
        ),
        _Step(
          title: l.obLookingTitle,
          content: ChoiceTiles(
            options: lookingForOptions(l),
            selected: _draft.lookingFor,
            onSelected: (v) => setState(() => _draft.lookingFor = v),
          ),
          valid: _draft.lookingFor.isNotEmpty,
        ),
        _Step(
          title: l.obPromptsTitle,
          hint: l.obPromptsHint,
          content: PromptsEditor(draft: _draft, onChanged: _changed),
          valid: true,
          optional: true,
        ),
        _Step(
          title: l.obBasicsTitle,
          hint: l.obBasicsHint,
          content: BasicsEditor(draft: _draft, onChanged: _changed),
          valid: true,
          optional: true,
        ),
      ];

  void _back() {
    if (_index > 0) setState(() => _index--);
  }

  Future<void> _next() async {
    final steps = _steps(AppLocalizations.of(context));
    if (!steps[_index].valid) return;
    FocusScope.of(context).unfocus();
    if (_index < steps.length - 1) {
      setState(() => _index++);
      return;
    }
    await _finish();
  }

  Future<void> _finish() async {
    final l = AppLocalizations.of(context);
    setState(() => _saving = true);
    try {
      await ref.read(apiProvider).saveProfile(_draft.toJson());
      ref.invalidate(meProvider);
      ref.read(sessionProvider.notifier).profileCompleted();
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final steps = _steps(l);
    final step = steps[_index];
    final last = _index == steps.length - 1;

    return PopScope(
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        body: SafeArea(
          child: Column(children: [
            // Üst çubuk: geri, ilerleme, atla
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, 8, 0),
              child: Row(children: [
                IconButton(
                  onPressed: _index == 0 ? () => ref.read(sessionProvider.notifier).logout() : _back,
                  icon: Icon(_index == 0 ? Icons.close_rounded : Icons.arrow_back_rounded),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(end: (_index + 1) / steps.length),
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeOut,
                      builder: (_, v, _) => LinearProgressIndicator(
                        value: v,
                        minHeight: 6,
                        color: Brand.coral,
                        backgroundColor: Brand.coral.withValues(alpha: 0.12),
                      ),
                    ),
                  ),
                ),
                SizedBox(
                  width: 64,
                  child: step.optional
                      ? TextButton(onPressed: last ? _finish : () => setState(() => _index++), child: Text(l.skip))
                      : Center(
                          child: Text(l.stepOf(_index + 1, steps.length),
                              style: Theme.of(context).textTheme.labelMedium),
                        ),
                ),
              ]),
            ),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                transitionBuilder: (child, anim) => FadeTransition(
                  opacity: anim,
                  child: SlideTransition(
                    position: Tween(begin: const Offset(0.06, 0), end: Offset.zero).animate(anim),
                    child: child,
                  ),
                ),
                child: ListView(
                  key: ValueKey(_index),
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
                  children: [
                    Text(step.title, style: Theme.of(context).textTheme.headlineMedium),
                    if (step.hint != null) ...[
                      const SizedBox(height: 8),
                      Text(step.hint!, style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          )),
                    ],
                    const SizedBox(height: 28),
                    step.content,
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
              child: GradientButton(
                label: last ? l.finish : l.continueLabel,
                busy: _saving,
                onPressed: step.valid ? _next : null,
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
