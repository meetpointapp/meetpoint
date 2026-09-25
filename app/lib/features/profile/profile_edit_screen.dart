import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/catalog.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import 'mood_widgets.dart';
import 'profile_fields.dart';
import 'profile_widgets.dart';
import 'vibe_screen.dart';

// Profil düzenleme: fotoğraflar anında kaydedilir, diğer bölümler
// ayrı sayfada düzenlenip "Kaydet" ile sunucuya gönderilir.
class ProfileEditScreen extends ConsumerStatefulWidget {
  const ProfileEditScreen({super.key});

  @override
  ConsumerState<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends ConsumerState<ProfileEditScreen> {
  ProfileDraft? _draft;

  @override
  void initState() {
    super.initState();
    ref.read(apiProvider).me().then((me) {
      if (mounted && me.profile != null) setState(() => _draft = ProfileDraft.from(me.profile!));
    });
  }

  // Bölümü kendi sayfasında düzenle; kaydedilirse taslağı güncelle
  Future<void> _editSection(String title, Widget Function(ProfileDraft d, VoidCallback changed) builder,
      {bool Function(ProfileDraft d)? valid}) async {
    final copy = _draft!.copy();
    final saved = await Navigator.of(context).push<bool>(MaterialPageRoute(
      builder: (_) => _SectionPage(title: title, draft: copy, builder: builder, valid: valid),
    ));
    if (saved == true) {
      setState(() => _draft = copy);
      ref.invalidate(meProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final d = _draft;
    return PopScope(
      onPopInvokedWithResult: (_, _) => ref.invalidate(meProvider),
      child: Scaffold(
        appBar: AppBar(title: Text(l.editProfile)),
        body: d == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 32), children: [
                _SectionTitle(l.photos),
                PhotoGridField(draft: d, onChanged: () => setState(() {})),
                const SizedBox(height: 8),
                _SectionTitle(l.personalInfo),
                _InfoCard(children: [
                  _InfoRow(l.displayName, d.displayName,
                      () => _editSection(l.displayName, (d, c) => NameField(draft: d, onChanged: c),
                          valid: (d) => d.displayName.trim().length >= 2)),
                  _InfoRow(l.birthDate, DateFormat.yMMMd(l.localeName).format(d.birthDate!),
                      () => _editSection(l.birthDate, (d, c) => BirthDateField(draft: d, onChanged: c))),
                  _InfoRow(l.gender, genderOptions(l).firstWhere((o) => o.id == d.gender).label,
                      () => _editSection(l.gender, (d, c) => ChoiceTiles(
                            options: genderOptions(l),
                            selected: d.gender,
                            onSelected: (v) {
                              d.gender = v;
                              c();
                            },
                          ))),
                  _InfoRow(l.interestedIn, interestedInOptions(l).firstWhere((o) => o.id == d.interestedIn).label,
                      () => _editSection(l.interestedIn, (d, c) => ChoiceTiles(
                            options: interestedInOptions(l),
                            selected: d.interestedIn,
                            onSelected: (v) {
                              d.interestedIn = v;
                              c();
                            },
                          ))),
                  _InfoRow(l.lookingFor, d.lookingFor.isEmpty ? '' : l.lookingForLabel(d.lookingFor),
                      () => _editSection(l.lookingFor, (d, c) => ChoiceTiles(
                            options: lookingForOptions(l),
                            selected: d.lookingFor,
                            onSelected: (v) {
                              d.lookingFor = v;
                              c();
                            },
                          ))),
                ]),
                _SectionTitle(l.interests, onEdit: () => _editSection(
                      '${l.interests} ($minInterests-$maxInterests)',
                      (d, c) => InterestPicker(draft: d, onChanged: c),
                      valid: (d) => d.interests.length >= minInterests,
                    )),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final id in d.interests) InterestChip(id),
                ]),
                _SectionTitle(l.prompts, onEdit: () => _editSection(l.prompts, (d, c) => PromptsEditor(draft: d, onChanged: c))),
                if (d.prompts.isEmpty)
                  Text(l.obPromptsHint, style: TextStyle(color: Theme.of(context).colorScheme.outline))
                else
                  for (final p in d.prompts) Padding(padding: const EdgeInsets.only(bottom: 8), child: PromptCard(prompt: p)),
                _SectionTitle(l.basics, onEdit: () => _editSection(l.basics, (d, c) => BasicsEditor(draft: d, onChanged: c))),
                BasicsChips(profile: d.toPreview(), showBio: true),
                _SectionTitle(l.showcaseSection,
                    onEdit: () => _editSection(l.showcaseSection, (d, c) => ShowcasePicker(draft: d, onChanged: c))),
                Row(children: [
                  Container(
                    width: 28,
                    height: 28,
                    margin: const EdgeInsets.only(right: 10),
                    decoration: BoxDecoration(shape: BoxShape.circle, color: themeColorOf(d.themeId)),
                  ),
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(colors: cardGradientOf(d.cardBackgroundId)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(d.themeId.isEmpty && d.cardBackgroundId.isEmpty ? l.showcaseDefault : l.showcaseCustom,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                ]),
                _SectionTitle(l.avatarSection,
                    onEdit: () => _editSection(l.avatarSection, (d, c) => AvatarPicker(draft: d, onChanged: c))),
                Row(children: [
                  AvatarFace(profile: d.toPreview(), size: 40),
                  const SizedBox(width: 12),
                  Text(l.avatarSection, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                ]),
                const SizedBox(height: 8),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.chair_alt_outlined),
                    title: Text(l.roomSection),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/room'),
                  ),
                ),
                const SizedBox(height: 8),
                _SectionTitle(l.vibeSection),
                _VibeSummary(),
                const SizedBox(height: 8),
                _SectionTitle(l.moodSection),
                _MoodSummary(),
                const SizedBox(height: 8),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.storefront_outlined),
                    title: Text(l.storeTitle),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.push('/store'),
                  ),
                ),
              ]),
      ),
    );
  }
}

class _SectionPage extends ConsumerStatefulWidget {
  const _SectionPage({required this.title, required this.draft, required this.builder, this.valid});
  final String title;
  final ProfileDraft draft;
  final Widget Function(ProfileDraft d, VoidCallback changed) builder;
  final bool Function(ProfileDraft d)? valid;

  @override
  ConsumerState<_SectionPage> createState() => _SectionPageState();
}

class _SectionPageState extends ConsumerState<_SectionPage> {
  bool _saving = false;

  Future<void> _save() async {
    final l = AppLocalizations.of(context);
    setState(() => _saving = true);
    try {
      await ref.read(apiProvider).saveProfile(widget.draft.toJson());
      if (mounted) {
        showSnack(context, l.saved);
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) showSnack(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final ok = widget.valid?.call(widget.draft) ?? true;
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [widget.builder(widget.draft, () => setState(() {}))],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: GradientButton(label: l.save, busy: _saving, onPressed: ok ? _save : null),
        ),
      ),
    );
  }
}

// Faz 16: vibe testi sonucu (varsa) veya teste başlama daveti. ProfileDraft'ta yok (ayrı uçtan
// /me/vibe ile kaydedilir); en güncel arketip için meProvider'ı doğrudan izler.
class _VibeSummary extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final archetypeId = ref.watch(meProvider).value?.profile?.vibeArchetypeId ?? '';
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Semantics(container: true): bir sonraki OutlinedButton'ın erişilebilirlik etiketine
      // karışmasın diye kendi ayrı düğümünde kalır (bitişik metin+düğme birleştirilebiliyor).
      Semantics(
        container: true,
        child: archetypeId.isNotEmpty
            ? VibeCard(archetypeId: archetypeId)
            : Text(l.vibeIntro, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
      ),
      const SizedBox(height: 10),
      OutlinedButton(
        onPressed: () async {
          await context.push<String>('/vibe');
          ref.invalidate(meProvider);
        },
        child: Text(archetypeId.isEmpty ? l.vibeStart : l.vibeRetake),
      ),
    ]);
  }
}

// Faz 16: günlük ruh hali. ProfileDraft'ta yok (ayrı uçtan /me/mood ile kaydedilir, "Kaydet"
// gerektirmez); en güncel durum için meProvider'ı doğrudan izler.
class _MoodSummary extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final moodId = ref.watch(meProvider).value?.profile?.moodId ?? '';
    return Row(children: [
      Expanded(
        // Semantics(container: true): "Değiştir" düğmesinin erişilebilirlik etiketine karışmasın
        child: Semantics(
          container: true,
          child: moodId.isNotEmpty
              ? MoodBadge(moodId: moodId)
              : Text(l.moodNotSet, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ),
      ),
      OutlinedButton(
        onPressed: () => showMoodSheet(context, ref),
        child: Text(moodId.isEmpty ? l.moodTitle : l.moodChange),
      ),
    ]);
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text, {this.onEdit});
  final String text;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 20, bottom: 10),
        child: Row(children: [
          Expanded(child: Text(text, style: Theme.of(context).textTheme.titleMedium)),
          if (onEdit != null)
            TextButton(
              onPressed: onEdit,
              style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
              child: Text(AppLocalizations.of(context).edit),
            ),
        ]),
      );
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
        child: Column(children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
            children[i],
          ],
        ]),
      );
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value, this.onTap);
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        dense: true,
        title: Text(label, style: Theme.of(context).textTheme.bodyMedium),
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(
            value.isEmpty ? AppLocalizations.of(context).notSpecified : value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: value.isEmpty ? Theme.of(context).colorScheme.outline : null,
                ),
          ),
          const Icon(Icons.chevron_right_rounded, size: 20),
        ]),
        onTap: onTap,
      );
}
