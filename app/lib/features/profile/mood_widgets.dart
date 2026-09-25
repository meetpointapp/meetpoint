import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/catalog.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 16: günlük ruh hali. Serbest metin yok — küçük bir emoji katalogundan tek seçim, 24 saatte
// kendiliğinden kaybolur (sunucu hesaplar). Seçim anında kaydedilir (PUT /me/mood), ayrı bir
// "Kaydet" adımı yok — showModalBottomSheet ile diğer hızlı seçim sayfaları (filtreler, boost) gibi.
Future<void> showMoodSheet(BuildContext context, WidgetRef ref) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => const _MoodSheet(),
  );
}

class _MoodSheet extends ConsumerStatefulWidget {
  const _MoodSheet();

  @override
  ConsumerState<_MoodSheet> createState() => _MoodSheetState();
}

class _MoodSheetState extends ConsumerState<_MoodSheet> {
  bool _busy = false;

  Future<void> _pick(String moodId) async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).setMood(moodId);
      ref.invalidate(meProvider);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showSnack(context, errorText(AppLocalizations.of(context), e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _clear() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).clearMood();
      ref.invalidate(meProvider);
      if (mounted) Navigator.pop(context);
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
    final current = ref.watch(meProvider).value?.profile?.moodId ?? '';
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l.moodTitle, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 16),
          Wrap(spacing: 10, runSpacing: 10, children: [
            for (final id in moodIds)
              ChoiceChip(
                label: Text('${moodEmoji[id]} ${l.moodLabel(id)}'),
                selected: id == current,
                onSelected: _busy ? null : (_) => _pick(id),
              ),
          ]),
          if (current.isNotEmpty) ...[
            const SizedBox(height: 16),
            Center(
              child: TextButton(
                onPressed: _busy ? null : _clear,
                child: Text(l.moodClear),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}

// Profil düzenlemede: mevcut ruh hali (varsa) veya günlük davet; başkasının profilinde de aynı
// rozet (salt görüntüleme) kullanılır.
class MoodBadge extends StatelessWidget {
  const MoodBadge({super.key, required this.moodId});
  final String moodId;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        shape: BoxShape.rectangle,
        borderRadius: BorderRadius.circular(20),
        color: Brand.coral.withValues(alpha: 0.1),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(moodEmoji[moodId] ?? '', style: const TextStyle(fontSize: 16)),
        const SizedBox(width: 6),
        Text(l.moodLabel(moodId), style: theme.textTheme.labelMedium?.copyWith(color: Brand.coral)),
      ]),
    );
  }
}
