import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.conversationId});
  final String conversationId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _input = TextEditingController();
  List<ChatMessage>? _messages;
  Object? _error;
  StreamSubscription<RealtimeEvent>? _sub;
  bool _sending = false;
  bool _otherTyping = false;
  bool _hasOlder = false; // daha eski mesaj var mı (sayfa dolu geldiyse)
  bool _loadingOlder = false;
  Timer? _typingTimer;
  DateTime _lastTypingSent = DateTime(2000);

  String get _id => widget.conversationId;

  @override
  void initState() {
    super.initState();
    _load();
    _sub = ref.read(realtimeProvider).events.listen(_onEvent);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _typingTimer?.cancel();
    _input.dispose();
    super.dispose();
  }

  void _onEvent(RealtimeEvent e) {
    final data = e.data is Map ? Map<String, dynamic>.from(e.data as Map) : const <String, dynamic>{};
    if (data['conversationId'] != _id) return;
    switch (e.name) {
      case 'message:new':
        _append(ChatMessage.fromJson(data));
        setState(() => _otherTyping = false);
        _markRead();
      case 'message:read':
        final readAt = DateTime.parse(data['readAt'] as String).toLocal();
        final myId = ref.read(sessionProvider).value?.userId;
        _update((m) => m.senderId == myId && m.readAt == null ? m.copyWith(readAt: readAt) : m);
      case 'message:viewed':
        _update((m) => m.id == data['id'] ? m.copyWith(viewedAt: DateTime.now()) : m);
      case 'typing':
        _typingTimer?.cancel();
        setState(() => _otherTyping = true);
        _typingTimer = Timer(const Duration(seconds: 3), () {
          if (mounted) setState(() => _otherTyping = false);
        });
    }
  }

  Future<void> _load() async {
    try {
      final list = await ref.read(apiProvider).messages(_id);
      if (mounted) {
        setState(() {
          _messages = list;
          _hasOlder = list.length == Api.messagePageSize;
        });
      }
      _markRead();
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  // Yukarı kaydırınca daha eski mesajlar
  Future<void> _loadOlder() async {
    final current = _messages;
    if (_loadingOlder || !_hasOlder || current == null || current.isEmpty) return;
    setState(() => _loadingOlder = true);
    try {
      final older = await ref.read(apiProvider).messages(_id, beforeId: current.first.id);
      if (!mounted) return;
      final known = current.map((m) => m.id).toSet();
      setState(() {
        _messages = [...older.where((m) => !known.contains(m.id)), ..._messages!];
        _hasOlder = older.length == Api.messagePageSize;
      });
    } catch (_) {
      // sessizce: bir sonraki kaydırmada tekrar denenir
    } finally {
      if (mounted) setState(() => _loadingOlder = false);
    }
  }

  Future<void> _markRead() async {
    await ref.read(apiProvider).markRead(_id).catchError((_) {});
    ref.invalidate(conversationsProvider);
  }

  void _append(ChatMessage msg) {
    if (!mounted || _messages == null || _messages!.any((m) => m.id == msg.id)) return;
    setState(() => _messages = [..._messages!, msg]);
  }

  void _update(ChatMessage Function(ChatMessage) f) {
    if (!mounted || _messages == null) return;
    setState(() => _messages = _messages!.map(f).toList());
  }

  // "Yazıyor" sinyali en fazla 2 saniyede bir gönderilir
  void _onTyping(String _) {
    final now = DateTime.now();
    if (now.difference(_lastTypingSent) < const Duration(seconds: 2)) return;
    _lastTypingSent = now;
    ref.read(realtimeProvider).emit('typing', {'conversationId': _id});
  }

  Future<void> _run(Future<ChatMessage> Function() send) async {
    if (_sending) return;
    setState(() => _sending = true);
    try {
      _append(await send());
      ref.invalidate(conversationsProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorText(AppLocalizations.of(context), e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    await _run(() async {
      final msg = await ref.read(apiProvider).sendMessage(_id, text);
      _input.clear();
      return msg;
    });
  }

  Future<void> _sendPhoto() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 85);
    if (file == null) return;
    await _run(() => ref.read(apiProvider).sendPhoto(_id, file));
  }

  Future<void> _openPhoto(ChatMessage m) async {
    final l = AppLocalizations.of(context);
    try {
      final bytes = await ref.read(apiProvider).openPhoto(m.id);
      _update((x) => x.id == m.id ? x.copyWith(viewedAt: DateTime.now()) : x);
      if (!mounted) return;
      await Navigator.of(context).push(PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black,
        pageBuilder: (_, _, _) => _PhotoViewer(bytes: bytes),
      ));
    } catch (e) {
      _update((x) => x.id == m.id ? x.copyWith(viewedAt: DateTime.now()) : x);
      if (mounted) showSnack(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final myId = ref.watch(sessionProvider).value?.userId;
    final other = ref.watch(conversationsProvider).value?.where((c) => c.id == _id).firstOrNull?.user;
    final messages = _messages;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: InkWell(
          onTap: other == null ? null : () => context.push('/user/${other.id}'),
          child: Row(children: [
            Avatar(other, radius: 18),
            const SizedBox(width: 10),
            Flexible(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                NameWithBadge(other?.displayName ?? '', verified: other?.verified ?? false),
                AnimatedSize(
                  duration: const Duration(milliseconds: 150),
                  child: _otherTyping
                      ? Text(l.typing, style: theme.textTheme.labelSmall?.copyWith(color: Brand.coral))
                      : const SizedBox.shrink(),
                ),
              ]),
            ),
          ]),
        ),
      ),
      body: Column(children: [
        Expanded(
          child: _error != null
              ? ErrorRetry(error: _error!, onRetry: _load)
              : messages == null
                  ? const Center(child: CircularProgressIndicator())
                  : ListView.builder(
                      reverse: true,
                      padding: const EdgeInsets.all(12),
                      // Liste ters: en üstteki (en eski) öğeye gelince önceki sayfa istenir
                      itemCount: messages.length + (_hasOlder ? 1 : 0),
                      itemBuilder: (_, i) {
                        if (i == messages.length) {
                          WidgetsBinding.instance.addPostFrameCallback((_) => _loadOlder());
                          return const Padding(
                            padding: EdgeInsets.all(12),
                            child: Center(child: SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2))),
                          );
                        }
                        final m = messages[messages.length - 1 - i];
                        return _Bubble(
                          message: m,
                          mine: m.senderId == myId,
                          locale: l.localeName,
                          onOpenPhoto: () => _openPhoto(m),
                        );
                      },
                    ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 8, 8),
            child: Row(children: [
              IconButton(
                tooltip: l.sendPhoto,
                onPressed: _sending ? null : _sendPhoto,
                icon: const Icon(Icons.add_photo_alternate_outlined),
              ),
              Expanded(
                child: TextField(
                  controller: _input,
                  minLines: 1,
                  maxLines: 5,
                  textInputAction: TextInputAction.send,
                  onChanged: _onTyping,
                  onSubmitted: (_) => _send(),
                  decoration: InputDecoration(
                    hintText: l.typeMessage,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 4),
              IconButton.filled(onPressed: _sending ? null : _send, icon: const Icon(Icons.send_rounded)),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.mine, required this.locale, required this.onOpenPhoto});
  final ChatMessage message;
  final bool mine;
  final String locale;
  final VoidCallback onOpenPhoto;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final fg = mine ? Colors.white : scheme.onSurface;
    final m = message;

    Widget content;
    if (m.isPhoto) {
      final opened = m.viewedAt != null;
      final canOpen = !mine && !opened;
      content = InkWell(
        onTap: canOpen ? onOpenPhoto : null,
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(opened ? Icons.visibility_off_outlined : Icons.photo_camera_outlined, color: fg, size: 20),
          const SizedBox(width: 8),
          Flexible(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(l.viewOncePhoto, style: TextStyle(color: fg, fontWeight: FontWeight.w600)),
              Text(
                opened ? l.photoOpened : (mine ? l.photoSent : l.tapToView),
                style: TextStyle(color: fg.withValues(alpha: 0.8), fontSize: 12),
              ),
            ]),
          ),
        ]),
      );
    } else {
      content = Text(m.body, style: TextStyle(color: fg));
    }

    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.75),
        margin: const EdgeInsets.symmetric(vertical: 3),
        padding: const EdgeInsets.fromLTRB(14, 8, 12, 6),
        decoration: BoxDecoration(
          gradient: mine ? Brand.gradient : null,
          color: mine ? null : scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(18).copyWith(
            bottomRight: mine ? const Radius.circular(4) : null,
            bottomLeft: mine ? null : const Radius.circular(4),
          ),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          content,
          const SizedBox(height: 2),
          Row(mainAxisSize: MainAxisSize.min, children: [
            Text(
              DateFormat.Hm(locale).format(m.createdAt),
              style: TextStyle(fontSize: 10, color: fg.withValues(alpha: 0.75)),
            ),
            // Okundu bilgisi: tek tik gönderildi, çift tik okundu
            if (mine) ...[
              const SizedBox(width: 3),
              Icon(m.readAt != null ? Icons.done_all_rounded : Icons.done_rounded, size: 14, color: fg.withValues(alpha: 0.85)),
            ],
          ]),
        ]),
      ),
    );
  }
}

// Tek seferlik fotoğraf görüntüleyici: kapatınca bir daha açılamaz
class _PhotoViewer extends StatelessWidget {
  const _PhotoViewer({required this.bytes});
  final Uint8List bytes;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(children: [
          Center(child: InteractiveViewer(child: Image.memory(bytes, fit: BoxFit.contain))),
          Positioned(
            top: 8,
            right: 8,
            child: IconButton.filled(
              style: IconButton.styleFrom(backgroundColor: Colors.white24),
              icon: const Icon(Icons.close_rounded, color: Colors.white),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 16,
            child: Text(l.viewOnceHint, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
          ),
        ]),
      ),
    );
  }
}
