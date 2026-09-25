import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../core/vibe.dart';
import '../../l10n/app_localizations.dart';
import 'profile_fields.dart';

// Faz 16: "Kendini Keşfet" vibe sistemi. Kısa, oyunlaştırılmış bir soru seti (yapay zekâ yok);
// puanlama sunucuda kural tabanlı yapılır (server/src/vibe.ts), burada sadece soruları sırayla
// sorup cevapları PUT /me/vibe ile gönderiyoruz — tıpkı OnboardingScreen'deki adım adım akış gibi.
class VibeQuizScreen extends ConsumerStatefulWidget {
  const VibeQuizScreen({super.key});

  @override
  ConsumerState<VibeQuizScreen> createState() => _VibeQuizScreenState();
}

class _VibeQuizScreenState extends ConsumerState<VibeQuizScreen> {
  final Map<String, String> _answers = {};
  int _index = 0;
  bool _saving = false;

  void _back() {
    if (_index > 0) setState(() => _index--);
  }

  Future<void> _select(String questionId, String optionId) async {
    setState(() => _answers[questionId] = optionId);
    await Future.delayed(const Duration(milliseconds: 180));
    if (!mounted) return;
    if (_index < vibeQuestions.length - 1) {
      setState(() => _index++);
    } else {
      await _finish();
    }
  }

  Future<void> _finish() async {
    final l = AppLocalizations.of(context);
    setState(() => _saving = true);
    try {
      final archetypeId = await ref.read(apiProvider).saveVibe(_answers);
      ref.invalidate(meProvider);
      if (mounted) Navigator.pop(context, archetypeId);
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final q = vibeQuestions[_index];
    final selected = _answers[q.id];

    return PopScope(
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        body: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, 8, 0),
              child: Row(children: [
                IconButton(
                  onPressed: _index == 0 ? () => Navigator.pop(context) : _back,
                  icon: Icon(_index == 0 ? Icons.close_rounded : Icons.arrow_back_rounded),
                  tooltip: _index == 0 ? MaterialLocalizations.of(context).closeButtonLabel : l.back,
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(end: (_index + 1) / vibeQuestions.length),
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
                  child: Center(
                    child: Text(l.stepOf(_index + 1, vibeQuestions.length), style: Theme.of(context).textTheme.labelMedium),
                  ),
                ),
              ]),
            ),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                transitionBuilder: (child, anim) => FadeTransition(
                  opacity: anim,
                  child: SlideTransition(position: Tween(begin: const Offset(0.06, 0), end: Offset.zero).animate(anim), child: child),
                ),
                child: ListView(
                  key: ValueKey(_index),
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
                  children: [
                    Text(l.vibeQuestionLabel(q.id), style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 28),
                    ChoiceTiles(
                      options: [for (final o in q.optionIds) (id: o, label: l.vibeOptionLabel(o), emoji: null)],
                      selected: selected ?? '',
                      onSelected: (v) => _select(q.id, v),
                    ),
                  ],
                ),
              ),
            ),
            if (_saving) const Padding(padding: EdgeInsets.only(bottom: 16), child: CircularProgressIndicator()),
          ]),
        ),
      ),
    );
  }
}

// Profilde/eşleşmede gösterilen vibe kartı: arketip adı + kısa açıklama, tema rengiyle uyumlu.
class VibeCard extends StatelessWidget {
  const VibeCard({super.key, required this.archetypeId});
  final String archetypeId;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(Brand.radius),
        gradient: LinearGradient(colors: [Brand.coral.withValues(alpha: 0.12), Brand.orange.withValues(alpha: 0.06)]),
      ),
      child: Row(children: [
        const Icon(Icons.auto_awesome_rounded, color: Brand.coral),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(l.vibeArchetypeName(archetypeId), style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(l.vibeArchetypeDesc(archetypeId), style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ]),
        ),
      ]),
    );
  }
}

// Eşleştiğin kişiyle "uyum notu": iki arketip arasındaki mesafeye göre kural tabanlı 3 kademe.
class VibeCompatNote extends StatelessWidget {
  const VibeCompatNote({super.key, required this.myArchetypeId, required this.otherArchetypeId});
  final String myArchetypeId;
  final String otherArchetypeId;

  @override
  Widget build(BuildContext context) {
    final tier = vibeCompatibilityTier(myArchetypeId, otherArchetypeId);
    if (tier == null) return const SizedBox.shrink();
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final note = l.vibeCompatNote(tier.name, l.vibeArchetypeName(myArchetypeId), l.vibeArchetypeName(otherArchetypeId));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(Brand.radius),
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
      ),
      child: Row(children: [
        const Icon(Icons.favorite_rounded, size: 18, color: Brand.coral),
        const SizedBox(width: 8),
        Expanded(child: Text(note, style: theme.textTheme.bodySmall)),
      ]),
    );
  }
}
