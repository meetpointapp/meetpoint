import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/fx.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import 'social_widgets.dart';

// Faz 22: hikayeler — 24 saat görünen yazı (renkli zemin) veya fotoğraf. Akışın üstünde halka olarak durur.

// ---------------------------------------------------------------- Halka şeridi
class StoryTray extends ConsumerWidget {
  const StoryTray({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final me = ref.watch(meProvider).value;
    final tray = ref.watch(storyTrayProvider).value ?? const <StoryTrayItem>[];
    final mine = tray.where((t) => t.mine).firstOrNull;
    final others = tray.where((t) => !t.mine).toList();
    final all = [?mine, ...others];

    Future<void> addStory() async {
      if (!isVerifiedMe(ref)) return showVerifyGate(context);
      final ok = await context.push<bool>('/story/new');
      if (ok == true) ref.invalidate(storyTrayProvider);
    }

    Future<void> open(StoryTrayItem item) async {
      await context.push('/stories', extra: StoryViewerArgs(all, all.indexOf(item)));
      ref.invalidate(storyTrayProvider);
    }

    return SizedBox(
      height: 100,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
        children: [
          // Kendi halkam: hikayem yoksa "+" ile ekleme, varsa izleme
          _Bubble(
            profile: me?.profile,
            label: l.storyYours,
            ring: mine != null ? (mine.hasUnseen ? _Ring.gradient : _Ring.seen) : _Ring.none,
            plus: mine == null,
            onTap: () => mine != null ? open(mine) : addStory(),
            onPlus: addStory,
          ),
          for (final item in others)
            _Bubble(
              profile: item.user,
              label: item.user.displayName,
              ring: item.hasUnseen ? _Ring.gradient : _Ring.seen,
              onTap: () => open(item),
            ),
        ],
      ),
    );
  }
}

enum _Ring { none, gradient, seen }

class _Bubble extends StatelessWidget {
  const _Bubble({required this.profile, required this.label, required this.ring, required this.onTap, this.plus = false, this.onPlus});
  final PublicProfile? profile;
  final String label;
  final _Ring ring;
  final VoidCallback onTap;
  final bool plus;
  final VoidCallback? onPlus;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    const size = 62.0;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: 68,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Stack(clipBehavior: Clip.none, children: [
              Container(
                width: size,
                height: size,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: ring == _Ring.gradient ? Brand.gradient : null,
                  border: ring == _Ring.seen ? Border.all(color: theme.colorScheme.outlineVariant, width: 2) : null,
                ),
                child: Container(
                  decoration: BoxDecoration(shape: BoxShape.circle, color: theme.scaffoldBackgroundColor),
                  padding: const EdgeInsets.all(2),
                  child: ClipOval(child: Avatar(profile, radius: size / 2 - 7)),
                ),
              ),
              if (plus)
                Positioned(
                  right: -2,
                  bottom: -2,
                  child: GestureDetector(
                    onTap: onPlus,
                    child: Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: Brand.gradient,
                        border: Border.all(color: theme.scaffoldBackgroundColor, width: 2),
                      ),
                      child: Icon(Icons.add_rounded, size: 15, color: Brand.onAccent),
                    ),
                  ),
                ),
            ]),
            const SizedBox(height: 5),
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- Görüntüleyici
class StoryViewerArgs {
  final List<StoryTrayItem> items;
  final int index;
  const StoryViewerArgs(this.items, this.index);
}

class StoryViewerScreen extends ConsumerStatefulWidget {
  const StoryViewerScreen({super.key, required this.args});
  final StoryViewerArgs args;

  @override
  ConsumerState<StoryViewerScreen> createState() => _StoryViewerScreenState();
}

class _StoryViewerScreenState extends ConsumerState<StoryViewerScreen> with SingleTickerProviderStateMixin {
  static const _duration = Duration(seconds: 5);
  late final AnimationController _ctl = AnimationController(vsync: this, duration: _duration);
  late int _user = widget.args.index.clamp(0, widget.args.items.length - 1);
  int _story = 0;
  final _viewed = <String>{};

  List<Story> get _stories => widget.args.items[_user].stories;
  Story get _current => _stories[_story];

  @override
  void initState() {
    super.initState();
    // İlk görülmemiş hikayeden başla
    final first = _stories.indexWhere((s) => !s.seen);
    _story = first < 0 ? 0 : first;
    _ctl.addStatusListener((s) {
      if (s == AnimationStatus.completed) _next();
    });
    _start();
  }

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  void _start() {
    _ctl.forward(from: 0);
    final s = _current;
    if (!s.mine && _viewed.add(s.id)) {
      unawaited(ref.read(apiProvider).viewStory(s.id).catchError((_) {}));
    }
  }

  void _goUser(int u) {
    final items = widget.args.items;
    if (u < 0) return _start();
    if (u >= items.length) return _close();
    setState(() {
      _user = u;
      final first = items[u].stories.indexWhere((s) => !s.seen);
      _story = first < 0 ? 0 : first;
    });
    _start();
  }

  void _next() {
    if (!mounted) return;
    if (_story < _stories.length - 1) {
      setState(() => _story++);
      _start();
    } else {
      _goUser(_user + 1);
    }
  }

  void _prev() {
    if (_story > 0) {
      setState(() => _story--);
      _start();
    } else {
      _goUser(_user - 1);
    }
  }

  void _close() {
    if (mounted && context.canPop()) context.pop();
  }

  Future<void> _showViewers() async {
    _ctl.stop();
    final l = AppLocalizations.of(context);
    final story = _current;
    List<StoryViewer> viewers = const [];
    try {
      viewers = await ref.read(apiProvider).storyViewers(story.id);
    } catch (_) {}
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(title: Text(l.storyViewers, style: Theme.of(ctx).textTheme.titleMedium), trailing: Text('${viewers.length}')),
          if (viewers.isEmpty)
            Padding(padding: const EdgeInsets.all(24), child: Text(l.storyNoViewers))
          else
            Flexible(
              child: ListView(shrinkWrap: true, children: [
                for (final v in viewers)
                  ListTile(
                    leading: Avatar(v.user, radius: 20),
                    title: NameWithBadge(v.user.displayName, verified: v.user.verified, premium: v.user.premium, badgeId: v.user.badgeId),
                    subtitle: Text(timeAgo(l, v.at)),
                    onTap: () {
                      Navigator.pop(ctx);
                      context.push('/user/${v.user.id}');
                    },
                  ),
              ]),
            ),
        ]),
      ),
    );
    if (mounted) _ctl.forward();
  }

  Future<void> _menu() async {
    _ctl.stop();
    final l = AppLocalizations.of(context);
    final story = _current;
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (story.mine) ListTile(leading: const Icon(Icons.delete_outline_rounded), title: Text(l.storyDelete), onTap: () => Navigator.pop(ctx, 'delete')),
          if (!story.mine) ListTile(leading: const Icon(Icons.flag_outlined), title: Text(l.postReport), onTap: () => Navigator.pop(ctx, 'report')),
        ]),
      ),
    );
    if (!mounted) return;
    if (action == 'delete') {
      try {
        await ref.read(apiProvider).deleteStory(story.id);
        if (!mounted) return;
        showSnack(context, l.storyDeleted);
        // Kalan hikaye yoksa kapat
        _close();
        return;
      } catch (e) {
        if (mounted) showSnack(context, errorText(l, e));
      }
    } else if (action == 'report') {
      await reportContent(context, ref, type: 'stories', id: story.id);
    }
    if (mounted) _ctl.forward();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final item = widget.args.items[_user];
    final story = _current;
    final top = MediaQuery.paddingOf(context).top;
    final isText = story.kind == 'text';
    final fg = isText ? storyTextColorOf(story.bg) : Colors.white;

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onLongPressStart: (_) => _ctl.stop(),
        onLongPressEnd: (_) => _ctl.forward(),
        onTapUp: (d) {
          final w = MediaQuery.sizeOf(context).width;
          if (d.localPosition.dx < w * 0.32) {
            _prev();
          } else {
            _next();
          }
        },
        onVerticalDragEnd: (d) {
          if ((d.primaryVelocity ?? 0) > 300) _close();
        },
        child: Stack(fit: StackFit.expand, children: [
          if (isText)
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: storyGradientOf(story.bg)),
              ),
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Text(
                    story.text,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: fg, fontSize: 28, fontWeight: FontWeight.w800, height: 1.25),
                  ),
                ),
              ),
            )
          else ...[
            NetPhoto(story.photo?.fullUrl, fit: BoxFit.contain),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.black54, Colors.transparent, Colors.transparent, Colors.black54], stops: [0, 0.2, 0.7, 1]),
              ),
            ),
            if (story.text.isNotEmpty)
              Positioned(
                left: 24,
                right: 24,
                bottom: 90,
                child: Text(story.text, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700, shadows: [Shadow(blurRadius: 8, color: Colors.black87)])),
              ),
          ],
          // İlerleme çubukları + başlık
          Positioned(
            top: top + 8,
            left: 12,
            right: 8,
            child: Column(children: [
              AnimatedBuilder(
                animation: _ctl,
                builder: (_, _) => Row(children: [
                  for (var i = 0; i < _stories.length; i++)
                    Expanded(
                      child: Container(
                        height: 3,
                        margin: const EdgeInsets.symmetric(horizontal: 2),
                        decoration: BoxDecoration(color: Colors.white30, borderRadius: BorderRadius.circular(2)),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: i < _story ? 1 : (i == _story ? _ctl.value : 0),
                          child: Container(decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(2))),
                        ),
                      ),
                    ),
                ]),
              ),
              const SizedBox(height: 10),
              Row(children: [
                GestureDetector(onTap: () => context.push('/user/${item.user.id}'), child: Avatar(item.user, radius: 18)),
                const SizedBox(width: 10),
                Expanded(
                  child: Row(children: [
                    Flexible(
                      child: Text(item.mine ? l.storyYours : item.user.displayName,
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 15, shadows: isText ? null : const [Shadow(blurRadius: 6, color: Colors.black54)])),
                    ),
                    const SizedBox(width: 8),
                    Text(timeAgo(l, story.createdAt), style: TextStyle(color: fg.withValues(alpha: 0.8), fontSize: 12)),
                  ]),
                ),
                IconButton(onPressed: _menu, icon: Icon(Icons.more_horiz_rounded, color: fg)),
                IconButton(onPressed: _close, icon: Icon(Icons.close_rounded, color: fg)),
              ]),
            ]),
          ),
          if (story.mine)
            Positioned(
              left: 0,
              right: 0,
              bottom: MediaQuery.paddingOf(context).bottom + 16,
              child: Center(
                child: GestureDetector(
                  onTap: _showViewers,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(24)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.visibility_outlined, color: Colors.white, size: 18),
                      const SizedBox(width: 8),
                      Text(l.storyViews(story.viewCount), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                    ]),
                  ),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- Oluşturucu
class StoryComposerScreen extends ConsumerStatefulWidget {
  const StoryComposerScreen({super.key});

  @override
  ConsumerState<StoryComposerScreen> createState() => _StoryComposerScreenState();
}

class _StoryComposerScreenState extends ConsumerState<StoryComposerScreen> {
  final _text = TextEditingController();
  String _bg = 'sunset';
  bool _photoMode = false;
  XFile? _file;
  bool _busy = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1440, imageQuality: 85);
    if (file != null && mounted) setState(() => _file = file);
  }

  bool get _ready => !_busy && (_photoMode ? _file != null : _text.text.trim().isNotEmpty);

  Future<void> _share() async {
    final l = AppLocalizations.of(context);
    if (!_ready) return;
    setState(() => _busy = true);
    try {
      final api = ref.read(apiProvider);
      final story = _photoMode ? await api.createPhotoStory(_file!, text: _text.text.trim()) : await api.createTextStory(_text.text.trim(), _bg);
      Fx.success();
      if (!mounted) return;
      showSnack(context, story.underReview ? l.storyUnderReview : l.storyShared);
      context.pop(true);
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
    final top = MediaQuery.paddingOf(context).top;
    final fg = _photoMode ? Colors.white : storyTextColorOf(_bg);

    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: Colors.black,
      body: Stack(fit: StackFit.expand, children: [
        if (_photoMode)
          GestureDetector(
            onTap: _pick,
            child: ColoredBox(
              color: const Color(0xFF111111),
              child: _file == null
                  ? Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.add_photo_alternate_outlined, color: Colors.white70, size: 56),
                        const SizedBox(height: 10),
                        Text(l.storyPickPhoto, style: const TextStyle(color: Colors.white70, fontSize: 16, fontWeight: FontWeight.w600)),
                      ]),
                    )
                  : FutureBuilder(
                      future: _file!.readAsBytes(),
                      builder: (_, snap) => snap.hasData ? Image.memory(snap.data!, fit: BoxFit.contain) : const SizedBox.shrink(),
                    ),
            ),
          )
        else
          DecoratedBox(
            decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: storyGradientOf(_bg))),
          ),
        // Yazı alanı: metin hikayesinde ortada büyük, fotoğrafta altta açıklama
        Positioned(
          left: 24,
          right: 24,
          top: _photoMode ? null : top + 90,
          bottom: _photoMode ? 130 : 160,
          child: Align(
            alignment: _photoMode ? Alignment.bottomCenter : Alignment.center,
            child: TextField(
              controller: _text,
              textAlign: TextAlign.center,
              maxLength: 200,
              maxLines: _photoMode ? 2 : 6,
              minLines: 1,
              onChanged: (_) => setState(() {}),
              buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
              style: TextStyle(color: fg, fontSize: _photoMode ? 18 : 28, fontWeight: FontWeight.w800, height: 1.25),
              cursorColor: fg,
              decoration: InputDecoration(
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                hintText: _photoMode ? l.storyCaption : l.storyHint,
                hintStyle: TextStyle(color: fg.withValues(alpha: 0.55), fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ),
        Positioned(
          top: top + 6,
          left: 6,
          right: 12,
          child: Row(children: [
            IconButton(onPressed: () => context.pop(false), icon: Icon(Icons.close_rounded, color: fg)),
            const Spacer(),
            SizedBox(
              height: 42,
              child: DecoratedBox(
                decoration: ShapeDecoration(shape: const StadiumBorder(), color: _ready ? Colors.white : Colors.white24),
                child: TextButton(
                  onPressed: _ready ? _share : null,
                  style: TextButton.styleFrom(foregroundColor: Colors.black, disabledForegroundColor: Colors.white60, shape: const StadiumBorder(), padding: const EdgeInsets.symmetric(horizontal: 22)),
                  child: _busy
                      ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.black))
                      : Text(l.storyShare, style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ),
          ]),
        ),
        // Alt çubuk: tür seçimi + zemin renkleri
        Positioned(
          left: 0,
          right: 0,
          bottom: MediaQuery.paddingOf(context).bottom + 14,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            if (!_photoMode)
              SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  children: [
                    for (final id in storyGradients.keys)
                      GestureDetector(
                        onTap: () => setState(() => _bg = id),
                        child: Container(
                          width: 36,
                          height: 36,
                          margin: const EdgeInsets.only(right: 10, top: 4),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LinearGradient(colors: storyGradientOf(id)),
                            border: Border.all(color: Colors.white, width: _bg == id ? 3 : 1),
                          ),
                        ),
                      ),
                  ],
                ),
              )
            else
              TextButton.icon(
                onPressed: _pick,
                icon: const Icon(Icons.photo_library_outlined, color: Colors.white),
                label: Text(l.storyPickPhoto, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              ),
            const SizedBox(height: 10),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              _ModeChip(label: l.storyText, icon: Icons.text_fields_rounded, on: !_photoMode, onTap: () => setState(() => _photoMode = false)),
              const SizedBox(width: 10),
              _ModeChip(label: l.storyPhoto, icon: Icons.photo_outlined, on: _photoMode, onTap: () => setState(() => _photoMode = true)),
            ]),
          ]),
        ),
      ]),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({required this.label, required this.icon, required this.on, required this.onTap});
  final String label;
  final IconData icon;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          decoration: BoxDecoration(
            color: on ? Colors.white : Colors.black38,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: Colors.white54),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 18, color: on ? Colors.black : Colors.white),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(color: on ? Colors.black : Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
          ]),
        ),
      );
}

// Bildirim/profil bağlantısıyla bir kullanıcının hikayelerini açar (/stories/user/:id)
class StoryByUserScreen extends ConsumerWidget {
  const StoryByUserScreen({super.key, required this.userId});
  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) => FutureBuilder<StoryTrayItem?>(
        future: ref.read(apiProvider).userStories(userId),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Scaffold(backgroundColor: Colors.black, body: Center(child: CircularProgressIndicator()));
          }
          final item = snap.data;
          if (item == null) {
            // Hikaye kalmamış (süresi dolmuş): profile dön
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (context.mounted && context.canPop()) context.pop();
            });
            return const Scaffold(backgroundColor: Colors.black);
          }
          return StoryViewerScreen(args: StoryViewerArgs([item], 0));
        },
      );
}
