import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../core/api.dart';
import '../../core/catalog.dart';
import '../../core/fx.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import 'message_outbox.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.conversationId});
  final String conversationId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _input = TextEditingController();
  List<ChatMessage>? _messages;
  List<IcebreakerGame> _games = [];
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
    _load().then((_) => _loadPending());
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
      case 'connect':
        _flushOutbox();
      case 'message:new':
        final msg = ChatMessage.fromJson(data);
        _append(msg);
        setState(() => _otherTyping = false);
        _markRead();
        // Mesajı aldığımızı (cihaza ulaştığını) sunucuya bildiriyoruz: çevrimdışıyken kaçırılan
        // mesajlar da yeniden bağlanınca message:new ile gelir ve burada teslim işaretlenir.
        ref.read(apiProvider).markDelivered(_id, [msg.id]).catchError((_) {});
      case 'message:read':
        final readAt = DateTime.parse(data['readAt'] as String).toLocal();
        final myId = ref.read(sessionProvider).value?.userId;
        _update((m) => m.senderId == myId && m.readAt == null ? m.copyWith(readAt: readAt, deliveredAt: readAt) : m);
      case 'message:viewed':
        _update((m) => m.id == data['id'] ? m.copyWith(viewedAt: DateTime.now()) : m);
      case 'message:delivered':
        final deliveredAt = DateTime.parse(data['deliveredAt'] as String).toLocal();
        final ids = (data['ids'] as List).cast<String>().toSet();
        _update((m) => ids.contains(m.id) ? m.copyWith(deliveredAt: deliveredAt) : m);
      case 'typing':
        _typingTimer?.cancel();
        setState(() => _otherTyping = true);
        _typingTimer = Timer(const Duration(seconds: 3), () {
          if (mounted) setState(() => _otherTyping = false);
        });
      case 'icebreaker:new':
        final g = IcebreakerGame.fromJson(data);
        if (!_games.any((x) => x.id == g.id)) setState(() => _games = [..._games, g]);
      case 'icebreaker:answered':
        final g = IcebreakerGame.fromJson(data);
        setState(() => _games = [for (final x in _games) x.id == g.id ? g : x]);
    }
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiProvider);
      final list = await api.messages(_id);
      // Buz kırıcı oyunlar mesajlarla aynı önceliğe sahip değil: yüklenemezse sessizce boş kalır
      final games = await api.icebreakerGames(_id).catchError((_) => <IcebreakerGame>[]);
      if (mounted) {
        setState(() {
          _messages = list;
          _games = games;
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

  // Faz 15: çevrimdışı kuyruk. Bu sohbette daha önce gönderilemeyen mesajlar varsa iyimser balon
  // olarak gösterilir ve göndermek yeniden denenir.
  Future<void> _loadPending() async {
    final myId = ref.read(sessionProvider).value?.userId;
    if (myId == null) return;
    final pending = await ref.read(messageOutboxProvider).pendingFor(_id, myId);
    if (!mounted || pending.isEmpty) return;
    setState(() => _messages = [...?_messages, ...pending]);
    await _flushOutbox();
  }

  // Kuyruktaki tüm sohbetlerin mesajlarını (bu sohbet dahil) sırayla tekrar dener; bu ekrandaki
  // iyimser balonları sonuca göre günceller.
  Future<void> _flushOutbox() async {
    final results = await ref.read(messageOutboxProvider).flush();
    if (!mounted) return;
    for (final r in results) {
      if (r.outcome.sent != null) {
        _replacePending(r.key, r.outcome.sent!);
      } else if (r.outcome.permanentFailure) {
        _markPendingFailed(r.key);
      }
    }
  }

  void _replacePending(String key, ChatMessage sent) {
    if (!mounted || _messages == null) return;
    setState(() => _messages = _messages!.map((m) => m.pendingKey == key ? sent : m).toList());
    ref.invalidate(conversationsProvider);
  }

  void _markPendingFailed(String key) {
    if (!mounted || _messages == null) return;
    setState(() => _messages = _messages!.map((m) => m.pendingKey == key ? m.copyWith(failed: true) : m).toList());
  }

  // Kalıcı olarak başarısız kalan bir mesaja dokununca: kuyruğa yeniden eklenir, tekrar denenir.
  Future<void> _retry(ChatMessage failed) async {
    if (!mounted || _messages == null) return;
    setState(() => _messages = _messages!.where((m) => m.id != failed.id).toList());
    final outbox = ref.read(messageOutboxProvider);
    final key = await outbox.enqueue(_id, failed.body);
    _append(ChatMessage.pending(conversationId: _id, senderId: failed.senderId, body: failed.body, key: key));
    final outcome = await outbox.attempt(key);
    if (outcome.sent != null) {
      _replacePending(key, outcome.sent!);
    } else if (outcome.permanentFailure) {
      _markPendingFailed(key);
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

  // Metin mesajları çevrimdışı kuyruktan gider (Faz 15): önce iyimser balon gösterilir, sunucuya
  // ulaşınca gerçek mesajla değiştirilir; ağ yoksa kuyrukta kalır ve bağlantı gelince tekrar denenir.
  Future<void> _send() async {
    final text = _input.text.trim();
    final myId = ref.read(sessionProvider).value?.userId;
    if (text.isEmpty || myId == null) return;
    Fx.tap();
    _input.clear();
    final outbox = ref.read(messageOutboxProvider);
    final key = await outbox.enqueue(_id, text);
    _append(ChatMessage.pending(conversationId: _id, senderId: myId, body: text, key: key));
    final outcome = await outbox.attempt(key);
    if (!mounted) return;
    if (outcome.sent != null) {
      _replacePending(key, outcome.sent!);
      if (outcome.sent!.contactWarning) showSnack(context, AppLocalizations.of(context).contactWarningSender);
    } else if (outcome.permanentFailure) {
      _markPendingFailed(key);
    }
    // Aksi halde (ağ yok) balon "gönderiliyor" durumunda kuyrukta kalır; bağlantı gelince otomatik dener.
  }

  Future<void> _sendPhoto() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 85);
    if (file == null) return;
    await _run(() => ref.read(apiProvider).sendPhoto(_id, file));
  }

  // Faz 17: sohbet içi buz kırıcı mini oyunlar
  Future<void> _openIcebreakerSheet() async {
    final l = AppLocalizations.of(context);
    final kind = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Align(alignment: Alignment.centerLeft, child: Text(l.icebreakerSheetTitle, style: Theme.of(ctx).textTheme.titleMedium)),
          ),
          ListTile(
            leading: const Icon(Icons.compare_arrows_rounded, color: Brand.coral),
            title: Text(l.icebreakerThisOrThat),
            subtitle: Text(l.icebreakerThisOrThatHint),
            onTap: () => Navigator.pop(ctx, 'this_or_that'),
          ),
          ListTile(
            leading: const Icon(Icons.theater_comedy_rounded, color: Brand.coral),
            title: Text(l.icebreakerTwoTruths),
            subtitle: Text(l.icebreakerTwoTruthsHint),
            onTap: () => Navigator.pop(ctx, 'two_truths'),
          ),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (!mounted || kind == null) return;
    if (kind == 'this_or_that') {
      await _startThisOrThatFlow();
    } else {
      await _startTwoTruthsFlow();
    }
  }

  Future<void> _startThisOrThatFlow() async {
    final picked = await showModalBottomSheet<(String, String)>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _ThisOrThatPicker(),
    );
    if (!mounted || picked == null) return;
    final (promptId, choice) = picked;
    try {
      final game = await ref.read(apiProvider).startThisOrThat(_id, promptId, choice);
      Fx.tap();
      setState(() => _games = [..._games, game]);
      ref.invalidate(conversationsProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorText(AppLocalizations.of(context), e));
    }
  }

  Future<void> _startTwoTruthsFlow() async {
    final picked = await showModalBottomSheet<(List<String>, int)>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => const _TwoTruthsComposer(),
    );
    if (!mounted || picked == null) return;
    final (statements, lieIndex) = picked;
    try {
      final game = await ref.read(apiProvider).startTwoTruths(_id, statements, lieIndex);
      Fx.tap();
      setState(() => _games = [..._games, game]);
      ref.invalidate(conversationsProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorText(AppLocalizations.of(context), e));
    }
  }

  Future<void> _answerIcebreaker(IcebreakerGame game, String choice) async {
    try {
      final updated = await ref.read(apiProvider).answerIcebreaker(_id, game.id, choice);
      Fx.success();
      setState(() => _games = [for (final g in _games) g.id == updated.id ? updated : g]);
    } catch (e) {
      if (mounted) showSnack(context, errorText(AppLocalizations.of(context), e));
    }
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
    // Faz 16: kozmetik mağaza — sohbet teması sadece benim kendi görünümümü etkiler (kişisel tercih)
    final myProfile = ref.watch(meProvider).value?.profile;
    final myBubbleColor = storeChatBubbleColorOf(myProfile?.chatBubbleThemeId ?? '');
    final myBackgroundColor = storeChatBackgroundColorOf(myProfile?.chatBackgroundThemeId ?? '');

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: InkWell(
          onTap: other == null ? null : () => context.push('/user/${other.id}'),
          child: Row(children: [
            Stack(clipBehavior: Clip.none, children: [
              Avatar(other, radius: 18),
              if (other != null)
                Positioned(
                  bottom: -2,
                  right: -2,
                  child: AvatarFace(profile: other, size: 18, border: theme.colorScheme.surface),
                ),
            ]),
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
          child: ColoredBox(
            color: myBackgroundColor ?? Colors.transparent,
            child: _error != null
                ? ErrorRetry(error: _error!, onRetry: _load)
                : messages == null
                    ? const Center(child: CircularProgressIndicator())
                    : Builder(builder: (context) {
                        // Faz 17: buz kırıcı oyunlar, mesajlarla aynı zaman çizelgesinde (oluşturulma
                        // zamanına göre) birleştirilir — sohbetin gerçek bir parçası gibi görünür.
                        final timeline = <Object>[...messages, ..._games]
                          ..sort((a, b) => (a is ChatMessage ? a.createdAt : (a as IcebreakerGame).createdAt)
                              .compareTo(b is ChatMessage ? b.createdAt : (b as IcebreakerGame).createdAt));
                        return ListView.builder(
                          reverse: true,
                          padding: const EdgeInsets.all(12),
                          // Liste ters: en üstteki (en eski) öğeye gelince önceki sayfa istenir
                          itemCount: timeline.length + (_hasOlder ? 1 : 0),
                          itemBuilder: (_, i) {
                            if (i == timeline.length) {
                              WidgetsBinding.instance.addPostFrameCallback((_) => _loadOlder());
                              return const Padding(
                                padding: EdgeInsets.all(12),
                                child: Center(child: SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2))),
                              );
                            }
                            final entry = timeline[timeline.length - 1 - i];
                            if (entry is IcebreakerGame) {
                              return _IcebreakerBubble(
                                game: entry,
                                mine: entry.starterId == myId,
                                otherName: other?.displayName ?? '',
                                onAnswer: (c) => _answerIcebreaker(entry, c),
                              );
                            }
                            final m = entry as ChatMessage;
                            return _Bubble(
                              message: m,
                              mine: m.senderId == myId,
                              locale: l.localeName,
                              bubbleColor: myBubbleColor,
                              onOpenPhoto: () => _openPhoto(m),
                              onRetry: m.failed ? () => _retry(m) : null,
                            );
                          },
                        );
                      }),
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
              IconButton(
                tooltip: l.icebreakerButton,
                onPressed: _openIcebreakerSheet,
                icon: const Icon(Icons.casino_outlined),
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
  const _Bubble({required this.message, required this.mine, required this.locale, required this.onOpenPhoto, this.onRetry, this.bubbleColor});
  final ChatMessage message;
  final bool mine;
  final String locale;
  final VoidCallback onOpenPhoto;
  final VoidCallback? onRetry;
  // Faz 16: kozmetik mağaza — sadece kendi mesaj baloncuklarımı etkiler (kişisel tercih)
  final Color? bubbleColor;

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

    // Faz 15: durum ikonu — saat: kuyrukta/gönderiliyor, tek tik: sunucuya ulaştı, soluk çift tik:
    // alıcıya ulaştı (henüz okumadı), belirgin çift tik: okundu. Başarısızsa hata ikonu (dokununca tekrar dener).
    final Widget status;
    if (m.failed) {
      status = Icon(Icons.error_outline_rounded, size: 14, color: Colors.orange.shade200);
    } else if (m.isPending) {
      status = Icon(Icons.schedule_rounded, size: 13, color: fg.withValues(alpha: 0.7));
    } else if (m.readAt != null) {
      status = Icon(Icons.done_all_rounded, size: 14, color: fg.withValues(alpha: 0.85));
    } else if (m.deliveredAt != null) {
      status = Icon(Icons.done_all_rounded, size: 14, color: fg.withValues(alpha: 0.55));
    } else {
      status = Icon(Icons.done_rounded, size: 14, color: fg.withValues(alpha: 0.85));
    }

    final bubble = Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onRetry,
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.75),
          margin: const EdgeInsets.symmetric(vertical: 3),
          padding: const EdgeInsets.fromLTRB(14, 8, 12, 6),
          decoration: BoxDecoration(
            gradient: mine && bubbleColor == null ? Brand.gradient : null,
            color: mine ? bubbleColor : scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(18).copyWith(
              bottomRight: mine ? const Radius.circular(4) : null,
              bottomLeft: mine ? null : const Radius.circular(4),
            ),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Opacity(opacity: m.isPending || m.failed ? 0.75 : 1, child: content),
            if (m.failed)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(l.sendFailedRetry, style: TextStyle(fontSize: 10, color: fg.withValues(alpha: 0.85))),
              ),
            const SizedBox(height: 2),
            Row(mainAxisSize: MainAxisSize.min, children: [
              Text(
                DateFormat.Hm(locale).format(m.createdAt),
                style: TextStyle(fontSize: 10, color: fg.withValues(alpha: 0.75)),
              ),
              if (mine) ...[const SizedBox(width: 3), status],
            ]),
          ]),
        ),
      ),
    );
    // İletişim bilgisi paylaşan mesajın altında alıcıya güvenlik ipucu
    if (mine || m.flag != 'contact') return bubble;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      bubble,
      Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 4),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.shield_outlined, size: 14, color: scheme.tertiary),
          const SizedBox(width: 4),
          Flexible(child: Text(l.contactSafetyTip, style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant))),
        ]),
      ),
    ]);
  }
}

// Faz 17: sohbet içi buz kırıcı mini oyun balonu. Üç durum: ben başlattım ve bekliyorum, karşı
// taraf başlattı ve benim cevaplamam gerekiyor, oyun cevaplandı (sonuç görünür).
class _IcebreakerBubble extends StatelessWidget {
  const _IcebreakerBubble({required this.game, required this.mine, required this.otherName, required this.onAnswer});
  final IcebreakerGame game;
  final bool mine; // ben mi başlattım
  final String otherName;
  final ValueChanged<String> onAnswer;

  String _choiceLabel(AppLocalizations l, String choice) {
    if (game.isThisOrThat) return choice == 'a' ? l.thisOrThatOptionA(game.promptId) : l.thisOrThatOptionB(game.promptId);
    final i = int.tryParse(choice);
    return i == null || i >= game.statements.length ? choice : game.statements[i];
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    Widget body;
    if (!game.answered && !mine) {
      // Karşı taraf başlattı, sıra bende
      body = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(game.isThisOrThat ? l.icebreakerYourTurnThisOrThat : l.icebreakerYourTurnTwoTruths,
            style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        if (game.isThisOrThat)
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => onAnswer('a'), child: Text(l.thisOrThatOptionA(game.promptId)))),
            const SizedBox(width: 8),
            Expanded(child: OutlinedButton(onPressed: () => onAnswer('b'), child: Text(l.thisOrThatOptionB(game.promptId)))),
          ])
        else
          for (final (i, s) in game.statements.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: OutlinedButton(
                onPressed: () => onAnswer('$i'),
                style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft),
                child: Text(s, overflow: TextOverflow.ellipsis),
              ),
            ),
      ]);
    } else if (!game.answered && mine) {
      // Ben başlattım, cevap bekleniyor
      body = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (game.isThisOrThat)
          Text(l.icebreakerYouChose(_choiceLabel(l, game.starterChoice)), style: theme.textTheme.bodyMedium)
        else
          for (final s in game.statements) Text('• $s', style: theme.textTheme.bodyMedium),
        const SizedBox(height: 6),
        Text(l.icebreakerWaitingForAnswer, style: theme.textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant)),
      ]);
    } else {
      // Cevaplandı: sonucu göster
      final starterLabel = game.isThisOrThat ? _choiceLabel(l, game.starterChoice) : null;
      final responderLabel = _choiceLabel(l, game.responderChoice ?? '');
      body = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (game.isThisOrThat) ...[
          Text(l.icebreakerYouChose(mine ? starterLabel! : responderLabel), style: theme.textTheme.bodyMedium),
          Text(l.icebreakerTheyChose(otherName, mine ? responderLabel : starterLabel!), style: theme.textTheme.bodyMedium),
          const SizedBox(height: 6),
          Text(
            game.starterChoice == game.responderChoice ? l.icebreakerSameAnswer : l.icebreakerDifferentAnswer,
            style: theme.textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w700, color: Brand.coral),
          ),
        ] else ...[
          for (final (i, s) in game.statements.indexed)
            Text(
              i == game.lieIndex ? '🤥 $s' : '✓ $s',
              style: theme.textTheme.bodyMedium?.copyWith(fontWeight: i == game.lieIndex ? FontWeight.w700 : null),
            ),
          const SizedBox(height: 6),
          Text(
            (int.tryParse(game.responderChoice ?? '') == game.lieIndex) ? l.icebreakerCorrectGuess : l.icebreakerWrongGuess,
            style: theme.textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w700, color: Brand.coral),
          ),
        ],
      ]);
    }

    return Align(
      alignment: Alignment.center,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Brand.coral.withValues(alpha: 0.25)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.casino_rounded, size: 16, color: Brand.coral),
            const SizedBox(width: 6),
            Text(game.isThisOrThat ? l.icebreakerThisOrThat : l.icebreakerTwoTruths,
                style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800, color: Brand.coral)),
          ]),
          const SizedBox(height: 10),
          body,
        ]),
      ),
    );
  }
}

// Faz 17: "bu mu o mu" başlatma — katalogdan bir soru seç, kendi cevabını seç
class _ThisOrThatPicker extends StatelessWidget {
  const _ThisOrThatPicker();

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return SafeArea(
      child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(16, 16, 16, 24), children: [
        Text(l.icebreakerThisOrThat, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        for (final id in thisOrThatPromptIds)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, (id, 'a')),
                    child: Text(l.thisOrThatOptionA(id), overflow: TextOverflow.ellipsis),
                  ),
                ),
                const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text('/')),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, (id, 'b')),
                    child: Text(l.thisOrThatOptionB(id), overflow: TextOverflow.ellipsis),
                  ),
                ),
              ]),
            ),
          ),
      ]),
    );
  }
}

// Faz 17: "2 doğru 1 yalan" oluşturma — 3 ifade yaz, birini yalan olarak işaretle
class _TwoTruthsComposer extends StatefulWidget {
  const _TwoTruthsComposer();
  @override
  State<_TwoTruthsComposer> createState() => _TwoTruthsComposerState();
}

class _TwoTruthsComposerState extends State<_TwoTruthsComposer> {
  final _controllers = List.generate(3, (_) => TextEditingController());
  int _lieIndex = 0;

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final valid = _controllers.every((c) => c.text.trim().isNotEmpty);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(context).bottom + 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l.icebreakerTwoTruths, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(l.icebreakerPickLie, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 12),
          RadioGroup<int>(
            groupValue: _lieIndex,
            onChanged: (v) => setState(() => _lieIndex = v!),
            child: Column(children: [
              for (final (i, c) in _controllers.indexed)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(children: [
                    Radio<int>(value: i),
                    Expanded(
                      child: TextField(
                        controller: c,
                        maxLength: 200,
                        decoration: InputDecoration(hintText: l.icebreakerStatementHint(i + 1)),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                  ]),
                ),
            ]),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: GradientButton(
              label: l.icebreakerSend,
              onPressed: valid ? () => Navigator.pop(context, ([for (final c in _controllers) c.text.trim()], _lieIndex)) : null,
            ),
          ),
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
