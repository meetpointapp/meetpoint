import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/catalog.dart';
import '../../core/config.dart';
import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Kayıt sihirbazı ve profil düzenleme için ortak alan düzenleyicileri.
// Hepsi aynı ProfileDraft'ı değiştirir ve onChanged ile üst widget'ı yeniler.

int ageFrom(DateTime birth) {
  final now = DateTime.now();
  var age = now.year - birth.year;
  if (now.month < birth.month || (now.month == birth.month && now.day < birth.day)) age--;
  return age;
}

class NameField extends StatefulWidget {
  const NameField({super.key, required this.draft, required this.onChanged, this.onSubmitted});
  final ProfileDraft draft;
  final VoidCallback onChanged;
  final VoidCallback? onSubmitted;

  @override
  State<NameField> createState() => _NameFieldState();
}

class _NameFieldState extends State<NameField> {
  late final _controller = TextEditingController(text: widget.draft.displayName);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextField(
        controller: _controller,
        autofocus: true,
        maxLength: 30,
        textCapitalization: TextCapitalization.words,
        style: Theme.of(context).textTheme.headlineSmall,
        decoration: InputDecoration(hintText: AppLocalizations.of(context).displayName, counterText: ''),
        onChanged: (v) {
          widget.draft.displayName = v;
          widget.onChanged();
        },
        onSubmitted: (_) => widget.onSubmitted?.call(),
      );
}

class BirthDateField extends StatelessWidget {
  const BirthDateField({super.key, required this.draft, required this.onChanged});
  final ProfileDraft draft;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final now = DateTime.now();
    final max = DateTime(now.year - 18, now.month, now.day);
    // Kullanıcı çarkı çevirene kadar tarih seçilmemiş sayılır (yanlış yaş kaydını önler)
    final selected = draft.birthDate;
    final initial = selected ?? DateTime(now.year - 25, 1, 1);
    return Column(children: [
      SizedBox(
        height: 200,
        child: CupertinoTheme(
          data: CupertinoThemeData(
            brightness: Theme.of(context).brightness,
            textTheme: CupertinoTextThemeData(
              dateTimePickerTextStyle: Theme.of(context).textTheme.titleLarge,
            ),
          ),
          child: CupertinoDatePicker(
            mode: CupertinoDatePickerMode.date,
            initialDateTime: initial.isAfter(max) ? max : initial,
            minimumDate: DateTime(now.year - 100),
            maximumDate: max,
            dateOrder: l.localeName == 'en' ? DatePickerDateOrder.mdy : DatePickerDateOrder.dmy,
            onDateTimeChanged: (d) {
              draft.birthDate = d;
              onChanged();
            },
          ),
        ),
      ),
      const SizedBox(height: 16),
      AnimatedSwitcher(
        duration: const Duration(milliseconds: 200),
        child: selected == null
            ? Text(l.selectDate,
                key: const ValueKey('hint'),
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ))
            : Container(
                key: const ValueKey('age'),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: ShapeDecoration(shape: const StadiumBorder(), color: Brand.coral.withValues(alpha: 0.12)),
                child: Text(l.obAgeLabel(ageFrom(selected)),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Brand.coral)),
              ),
      ),
    ]);
  }
}

// Büyük, tek seçimli seçenek kutuları (cinsiyet, ilgilendiğin, ne arıyorsun)
class ChoiceTiles extends StatelessWidget {
  const ChoiceTiles({super.key, required this.options, required this.selected, required this.onSelected});
  final List<({String id, String label, String? emoji})> options;
  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(children: [
      for (final o in options)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Brand.radius),
              border: Border.all(
                color: o.id == selected ? Brand.coral : scheme.outlineVariant,
                width: o.id == selected ? 2 : 1,
              ),
              color: o.id == selected ? Brand.coral.withValues(alpha: 0.08) : null,
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(Brand.radius),
              onTap: () => onSelected(o.id),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                child: Row(children: [
                  if (o.emoji != null) ...[Text(o.emoji!, style: const TextStyle(fontSize: 22)), const SizedBox(width: 14)],
                  Expanded(child: Text(o.label, style: Theme.of(context).textTheme.titleMedium)),
                  AnimatedOpacity(
                    duration: const Duration(milliseconds: 180),
                    opacity: o.id == selected ? 1 : 0,
                    child: const Icon(Icons.check_circle_rounded, color: Brand.coral),
                  ),
                ]),
              ),
            ),
          ),
        ),
    ]);
  }
}

List<({String id, String label, String? emoji})> genderOptions(AppLocalizations l) => [
      (id: 'female', label: l.female, emoji: null),
      (id: 'male', label: l.male, emoji: null),
      (id: 'other', label: l.other, emoji: null),
    ];

List<({String id, String label, String? emoji})> interestedInOptions(AppLocalizations l) => [
      (id: 'female', label: l.women, emoji: null),
      (id: 'male', label: l.men, emoji: null),
      (id: 'everyone', label: l.everyone, emoji: null),
    ];

List<({String id, String label, String? emoji})> lookingForOptions(AppLocalizations l) => [
      for (final e in lookingForEmoji.entries) (id: e.key, label: l.lookingForLabel(e.key), emoji: e.value),
    ];

// Fotoğraf ızgarası: ekleme anında sunucuya yüklenir; dokununca kapak yap / sil
class PhotoGridField extends ConsumerStatefulWidget {
  const PhotoGridField({super.key, required this.draft, required this.onChanged});
  final ProfileDraft draft;
  final VoidCallback onChanged;

  @override
  ConsumerState<PhotoGridField> createState() => _PhotoGridFieldState();
}

class _PhotoGridFieldState extends ConsumerState<PhotoGridField> {
  bool _uploading = false;

  Future<void> _add() async {
    final l = AppLocalizations.of(context);
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1440, imageQuality: 85);
    if (file == null) return;
    setState(() => _uploading = true);
    try {
      final photo = await ref.read(apiProvider).uploadPhoto(file);
      widget.draft.photos = [...widget.draft.photos, photo];
      widget.onChanged();
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _options(Photo photo, int index) async {
    final l = AppLocalizations.of(context);
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (index > 0)
            ListTile(
              leading: const Icon(Icons.star_rounded),
              title: Text(l.makeCover),
              onTap: () => Navigator.pop(ctx, 'cover'),
            ),
          ListTile(
            leading: Icon(Icons.delete_outline_rounded, color: Theme.of(ctx).colorScheme.error),
            title: Text(l.deletePhoto, style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
            onTap: () => Navigator.pop(ctx, 'delete'),
          ),
        ]),
      ),
    );
    if (action == null || !mounted) return;
    final api = ref.read(apiProvider);
    final previous = widget.draft.photos;
    try {
      if (action == 'cover') {
        widget.draft.photos = [photo, ...previous.where((p) => p.id != photo.id)];
        widget.onChanged();
        await api.reorderPhotos([for (final p in widget.draft.photos) p.id]);
      } else {
        widget.draft.photos = previous.where((p) => p.id != photo.id).toList();
        widget.onChanged();
        await api.deletePhoto(photo.id);
      }
    } catch (e) {
      widget.draft.photos = previous;
      widget.onChanged();
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final photos = widget.draft.photos;
    final scheme = Theme.of(context).colorScheme;
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 3 / 4,
      ),
      itemCount: maxPhotos,
      itemBuilder: (_, i) {
        if (i < photos.length) {
          return GestureDetector(
            onTap: () => _options(photos[i], i),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Stack(fit: StackFit.expand, children: [
                NetPhoto(photos[i].thumbUrl, width: 160, height: 160),
                if (photos[i].underReview)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: ShapeDecoration(shape: const StadiumBorder(), color: Colors.black.withValues(alpha: 0.65)),
                      child: Text(l.photoUnderReview,
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ),
                if (i == 0)
                  Positioned(
                    left: 6,
                    bottom: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: const ShapeDecoration(shape: StadiumBorder(), gradient: Brand.gradient),
                      child: Text(l.cover,
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ),
              ]),
            ),
          );
        }
        final isNext = i == photos.length;
        return Material(
          color: scheme.surfaceContainerHighest.withValues(alpha: isNext ? 1 : 0.5),
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: isNext && !_uploading ? _add : null,
            child: Center(
              child: isNext && _uploading
                  ? const CircularProgressIndicator()
                  : Icon(Icons.add_rounded, size: 30, color: isNext ? Brand.coral : scheme.outline),
            ),
          ),
        );
      },
    );
  }
}

class InterestPicker extends StatelessWidget {
  const InterestPicker({super.key, required this.draft, required this.onChanged});
  final ProfileDraft draft;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final full = draft.interests.length >= maxInterests;
    return Wrap(spacing: 8, runSpacing: 8, children: [
      for (final id in interestIds)
        FilterChip(
          showCheckmark: false,
          label: Text('${interestEmoji[id]} ${l.interestLabel(id)}'),
          selected: draft.interests.contains(id),
          onSelected: (on) {
            if (on && full) return;
            draft.interests = on ? [...draft.interests, id] : draft.interests.where((x) => x != id).toList();
            onChanged();
          },
        ),
    ]);
  }
}

// Profil soruları: en fazla 3 soru seçilip cevaplanır
class PromptsEditor extends StatelessWidget {
  const PromptsEditor({super.key, required this.draft, required this.onChanged});
  final ProfileDraft draft;
  final VoidCallback onChanged;

  Future<void> _edit(BuildContext context, {ProfilePrompt? existing}) async {
    final l = AppLocalizations.of(context);
    var promptId = existing?.id;
    if (promptId == null) {
      final used = draft.prompts.map((p) => p.id).toSet();
      promptId = await showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        builder: (ctx) => SafeArea(
          child: ListView(shrinkWrap: true, children: [
            ListTile(title: Text(l.choosePrompt, style: Theme.of(ctx).textTheme.titleMedium)),
            for (final id in promptIds.where((id) => !used.contains(id)))
              ListTile(title: Text(l.promptQuestion(id)), onTap: () => Navigator.pop(ctx, id)),
          ]),
        ),
      );
      if (promptId == null || !context.mounted) return;
    }
    final id = promptId;
    final answer = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PromptAnswerSheet(question: l.promptQuestion(id), initial: existing?.answer ?? ''),
    );
    if (answer == null) return;
    final updated = ProfilePrompt(id, answer);
    draft.prompts = existing == null
        ? [...draft.prompts, updated]
        : [for (final p in draft.prompts) p.id == existing.id ? updated : p];
    onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final p in draft.prompts)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Card(
            child: InkWell(
              onTap: () => _edit(context, existing: p),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 4, 14),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(l.promptQuestion(p.id), style: Theme.of(context).textTheme.labelLarge?.copyWith(color: Brand.coral)),
                      const SizedBox(height: 4),
                      Text(p.answer, style: Theme.of(context).textTheme.titleMedium),
                    ]),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    tooltip: l.remove,
                    onPressed: () {
                      draft.prompts = draft.prompts.where((x) => x.id != p.id).toList();
                      onChanged();
                    },
                  ),
                ]),
              ),
            ),
          ),
        ),
      if (draft.prompts.length < maxPrompts)
        OutlinedButton.icon(
          onPressed: () => _edit(context),
          icon: const Icon(Icons.add_rounded),
          label: Text(l.addPrompt),
        ),
    ]);
  }
}

class _PromptAnswerSheet extends StatefulWidget {
  const _PromptAnswerSheet({required this.question, required this.initial});
  final String question;
  final String initial;

  @override
  State<_PromptAnswerSheet> createState() => _PromptAnswerSheetState();
}

class _PromptAnswerSheetState extends State<_PromptAnswerSheet> {
  late final _controller = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(widget.question, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        TextField(
          controller: _controller,
          autofocus: true,
          maxLines: 4,
          minLines: 2,
          maxLength: promptMaxLength,
          decoration: InputDecoration(hintText: l.yourAnswer),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 8),
        GradientButton(
          label: l.done,
          onPressed: _controller.text.trim().isEmpty ? null : () => Navigator.pop(context, _controller.text.trim()),
        ),
      ]),
    );
  }
}

// Temel bilgiler: hepsi isteğe bağlı, her satır bir alt sayfa açar
class BasicsEditor extends StatefulWidget {
  const BasicsEditor({super.key, required this.draft, required this.onChanged});
  final ProfileDraft draft;
  final VoidCallback onChanged;

  @override
  State<BasicsEditor> createState() => _BasicsEditorState();
}

class _BasicsEditorState extends State<BasicsEditor> {
  late final _bio = TextEditingController(text: widget.draft.bio);
  late final _job = TextEditingController(text: widget.draft.job);
  late final _city = TextEditingController(text: widget.draft.city);

  @override
  void dispose() {
    _bio.dispose();
    _job.dispose();
    _city.dispose();
    super.dispose();
  }

  Future<String?> _pick(String title, List<(String, String)> options, String current) {
    final l = AppLocalizations.of(context);
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: ListView(shrinkWrap: true, children: [
          ListTile(title: Text(title, style: Theme.of(ctx).textTheme.titleMedium)),
          for (final (id, label) in options)
            ListTile(
              title: Text(label),
              trailing: id == current ? const Icon(Icons.check_rounded, color: Brand.coral) : null,
              onTap: () => Navigator.pop(ctx, id),
            ),
          if (current.isNotEmpty) ListTile(title: Text(l.clear), onTap: () => Navigator.pop(ctx, '')),
        ]),
      ),
    );
  }

  Future<void> _pickHeight() async {
    final l = AppLocalizations.of(context);
    var value = widget.draft.heightCm ?? 170;
    final result = await showModalBottomSheet<int?>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SizedBox(
            height: 180,
            child: CupertinoPicker(
              itemExtent: 40,
              scrollController: FixedExtentScrollController(initialItem: value - 120),
              onSelectedItemChanged: (i) => value = 120 + i,
              children: [for (var cm = 120; cm <= 230; cm++) Center(child: Text(l.heightCm(cm)))],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx, -1), child: Text(l.clear))),
              const SizedBox(width: 12),
              Expanded(child: FilledButton(onPressed: () => Navigator.pop(ctx, value), child: Text(l.done))),
            ]),
          ),
        ]),
      ),
    );
    if (result == null) return;
    widget.draft.heightCm = result == -1 ? null : result;
    _changed();
  }

  void _changed() {
    setState(() {});
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final d = widget.draft;

    Widget row(IconData icon, String label, String value, VoidCallback onTap) => ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(icon),
          title: Text(label),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(value.isEmpty ? l.notSpecified : value,
                style: TextStyle(color: value.isEmpty ? Theme.of(context).colorScheme.outline : null)),
            const Icon(Icons.chevron_right_rounded),
          ]),
          onTap: onTap,
        );

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      TextField(
        controller: _bio,
        maxLines: 3,
        minLines: 2,
        maxLength: 500,
        decoration: InputDecoration(labelText: l.bio, alignLabelWithHint: true),
        onChanged: (v) {
          d.bio = v;
          widget.onChanged();
        },
      ),
      Row(children: [
        Expanded(
          child: TextField(
            controller: _job,
            maxLength: 60,
            decoration: InputDecoration(labelText: l.job, counterText: ''),
            onChanged: (v) {
              d.job = v;
              widget.onChanged();
            },
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: TextField(
            controller: _city,
            maxLength: 60,
            decoration: InputDecoration(labelText: l.city, counterText: ''),
            onChanged: (v) {
              d.city = v;
              widget.onChanged();
            },
          ),
        ),
      ]),
      const SizedBox(height: 8),
      row(Icons.straighten_rounded, l.height, d.heightCm == null ? '' : l.heightCm(d.heightCm!), _pickHeight),
      row(Icons.school_outlined, l.education, d.education.isEmpty ? '' : l.educationLabel(d.education), () async {
        final v = await _pick(l.education, [for (final id in educationIds) (id, l.educationLabel(id))], d.education);
        if (v != null) {
          d.education = v;
          _changed();
        }
      }),
      row(Icons.auto_awesome_outlined, l.zodiac, d.zodiac.isEmpty ? '' : l.zodiacLabel(d.zodiac), () async {
        final v = await _pick(l.zodiac, [for (final id in zodiacIds) (id, l.zodiacLabel(id))], d.zodiac);
        if (v != null) {
          d.zodiac = v;
          _changed();
        }
      }),
      row(Icons.smoking_rooms_outlined, l.smoking, d.smoking.isEmpty ? '' : l.habitLabel(d.smoking), () async {
        final v = await _pick(l.smoking, [for (final id in habitIds) (id, l.habitLabel(id))], d.smoking);
        if (v != null) {
          d.smoking = v;
          _changed();
        }
      }),
      row(Icons.local_bar_outlined, l.drinking, d.drinking.isEmpty ? '' : l.habitLabel(d.drinking), () async {
        final v = await _pick(l.drinking, [for (final id in habitIds) (id, l.habitLabel(id))], d.drinking);
        if (v != null) {
          d.drinking = v;
          _changed();
        }
      }),
    ]);
  }
}

// Faz 16: kişisel profil vitrini — renk (rozet/vurgu) ve kart zemini ayrı seçilir; ikisi de boşsa
// varsayılan marka görünümü kullanılır. Swatch'e dokunmak seçili olanı tekrar seçersen kaldırır.
class ShowcasePicker extends StatelessWidget {
  const ShowcasePicker({super.key, required this.draft, required this.onChanged});
  final ProfileDraft draft;
  final VoidCallback onChanged;

  Widget _swatches(BuildContext context, List<String> ids, String selected, Widget Function(String) swatchFor, ValueChanged<String> onSelect) {
    return Wrap(spacing: 12, runSpacing: 12, children: [
      for (final id in ids)
        GestureDetector(
          onTap: () => onSelect(id == selected ? '' : id),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: id == selected ? Theme.of(context).colorScheme.onSurface : Colors.transparent, width: 2.5),
            ),
            padding: const EdgeInsets.all(3),
            child: swatchFor(id),
          ),
        ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(l.showcaseTheme, style: theme.textTheme.titleSmall),
      const SizedBox(height: 4),
      Text(l.showcaseThemeHint, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
      const SizedBox(height: 10),
      _swatches(
        context,
        themeIds,
        draft.themeId,
        (id) => DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, color: themeColorOf(id))),
        (id) {
          draft.themeId = id;
          onChanged();
        },
      ),
      const SizedBox(height: 24),
      Text(l.showcaseBackground, style: theme.textTheme.titleSmall),
      const SizedBox(height: 10),
      _swatches(
        context,
        cardBackgroundIds,
        draft.cardBackgroundId,
        (id) => DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: cardGradientOf(id)),
          ),
        ),
        (id) {
          draft.cardBackgroundId = id;
          onChanged();
        },
      ),
    ]);
  }
}
