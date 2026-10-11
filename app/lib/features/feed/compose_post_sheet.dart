import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/fx.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import '../profile/profile_widgets.dart';

const postMaxLength = 280;

// Faz 22: gönderi paylaşma sayfası. Başarılıysa oluşan gönderiyi döndürür.
Future<Post?> showComposePostSheet(BuildContext context) => showModalBottomSheet<Post>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const _ComposeSheet(),
    );

class _ComposeSheet extends ConsumerStatefulWidget {
  const _ComposeSheet();

  @override
  ConsumerState<_ComposeSheet> createState() => _ComposeSheetState();
}

class _ComposeSheetState extends ConsumerState<_ComposeSheet> {
  final _text = TextEditingController();
  String _interest = '';
  bool _busy = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _share() async {
    final l = AppLocalizations.of(context);
    final body = _text.text.trim();
    if (body.isEmpty || _busy) return;
    setState(() => _busy = true);
    try {
      final post = await ref.read(apiProvider).createPost(body, interest: _interest);
      Fx.success();
      if (mounted) {
        Navigator.pop(context, post);
        showSnack(context, l.postShared);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showSnack(context, errorText(l, e));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final me = ref.watch(meProvider).value;
    final interests = me?.profile?.interests ?? const <String>[];
    final length = _text.text.characters.length;
    final left = postMaxLength - length;
    final ready = _text.text.trim().isNotEmpty && !_busy;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(l.postNew, style: theme.textTheme.titleLarge)),
            SizedBox(
              height: 40,
              child: DecoratedBox(
                decoration: ShapeDecoration(shape: const StadiumBorder(), gradient: ready ? Brand.gradient : null, color: ready ? null : theme.colorScheme.surfaceContainerHighest),
                child: TextButton(
                  onPressed: ready ? _share : null,
                  style: TextButton.styleFrom(
                    foregroundColor: Brand.onAccent,
                    disabledForegroundColor: theme.colorScheme.onSurfaceVariant,
                    shape: const StadiumBorder(),
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                  ),
                  child: _busy
                      ? SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: Brand.onAccent))
                      : Text(l.postShare, style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 14),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Avatar(me?.profile, radius: 22),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _text,
                autofocus: true,
                minLines: 4,
                maxLines: 8,
                maxLength: postMaxLength,
                buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                onChanged: (_) => setState(() {}),
                style: theme.textTheme.titleMedium?.copyWith(height: 1.4, fontWeight: FontWeight.w500),
                decoration: InputDecoration(
                  hintText: l.postHint,
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ),
          ]),
          if (interests.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(l.postInterestLabel, style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final id in interests)
                GestureDetector(
                  onTap: () => setState(() => _interest = _interest == id ? '' : id),
                  child: Opacity(opacity: _interest == id || _interest.isEmpty ? 1 : 0.5, child: InterestChip(id, highlighted: _interest == id)),
                ),
            ]),
          ],
          const SizedBox(height: 12),
          Row(children: [
            Icon(Icons.shield_outlined, size: 16, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(width: 6),
            Expanded(child: Text(l.postContactRule, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant))),
            const SizedBox(width: 8),
            Text('$left', style: theme.textTheme.labelLarge?.copyWith(color: left < 20 ? Brand.nope : theme.colorScheme.onSurfaceVariant, fontWeight: FontWeight.w800)),
          ]),
        ]),
      ),
    );
  }
}
