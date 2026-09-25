import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api.dart';
import '../../core/models.dart';
import '../../core/session.dart';

// Çevrimdışı mesaj kuyruğu (Faz 15: mesaj teslim garantisi). Gönderilemeyen mesajlar diskte
// saklanır; her birinin kalıcı bir anahtarı vardır (sunucudaki Idempotency-Key ile eşleşir), bu
// yüzden uygulama yeniden başlasa ve aynı mesaj tekrar denense de sunucuda iki kez işlenmez.
// Sırayla (en eskiden başlayarak) denenir; ağ hatasında kuyrukta kalır, sunucu kalıcı olarak
// reddederse (engellendi, kısıtlandı vb.) kuyruktan düşer.
class _PendingMessage {
  final String key;
  final String conversationId;
  final String body;
  final DateTime createdAt;
  const _PendingMessage({required this.key, required this.conversationId, required this.body, required this.createdAt});

  Map<String, dynamic> toJson() => {'key': key, 'conversationId': conversationId, 'body': body, 'createdAt': createdAt.toIso8601String()};
  factory _PendingMessage.fromJson(Map<String, dynamic> j) => _PendingMessage(
        key: j['key'] as String,
        conversationId: j['conversationId'] as String,
        body: j['body'] as String,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
}

// sent: gönderildi. permanentFailure: sunucu kalıcı reddetti (kuyruktan düştü, tekrar denenmez).
// İkisi de boşsa: ağ yok, kuyrukta kaldı, bir sonraki flush()'ta tekrar denenir.
typedef SendOutcome = ({ChatMessage? sent, bool permanentFailure});

class MessageOutbox {
  MessageOutbox(this._api);
  final Api _api;
  static const _prefsKey = 'message_outbox_v1';
  final _pending = <_PendingMessage>[];
  bool _loaded = false;
  bool _flushing = false;

  Future<void> _ensureLoaded() async {
    if (_loaded) return;
    _loaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_prefsKey);
      if (raw == null) return;
      final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
      _pending.addAll(list.map(_PendingMessage.fromJson));
    } catch (_) {
      // Bozuk/okunamayan kayıt: sıfırdan başla
    }
  }

  Future<void> _save() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, jsonEncode(_pending.map((p) => p.toJson()).toList()));
    } catch (_) {}
  }

  // Sohbet ekranı açılırken: bu sohbette kuyrukta bekleyen mesajlar varsa iyimser balon olarak
  // gösterilsin diye ChatMessage'a çevrilir.
  Future<List<ChatMessage>> pendingFor(String conversationId, String myId) async {
    await _ensureLoaded();
    return [
      for (final p in _pending.where((p) => p.conversationId == conversationId))
        ChatMessage.pending(conversationId: p.conversationId, senderId: myId, body: p.body, key: p.key, createdAt: p.createdAt),
    ];
  }

  // Kuyruğa ekler; sunucudaki istek buna eşlik eden iyimser balon çizilebilsin diye anahtarı
  // hemen döndürür. Göndermeyi denemek için attempt() çağrılmalı.
  Future<String> enqueue(String conversationId, String body) async {
    await _ensureLoaded();
    final key = Api.newIdempotencyKey();
    _pending.add(_PendingMessage(key: key, conversationId: conversationId, body: body, createdAt: DateTime.now()));
    await _save();
    return key;
  }

  Future<SendOutcome> attempt(String key) async {
    await _ensureLoaded();
    for (final msg in _pending) {
      if (msg.key == key) return _attempt(msg);
    }
    return (sent: null, permanentFailure: true); // zaten işlenmiş veya kuyrukta yok
  }

  Future<SendOutcome> _attempt(_PendingMessage msg) async {
    try {
      final sent = await _api.sendMessage(msg.conversationId, msg.body, idempotencyKey: msg.key);
      _pending.removeWhere((p) => p.key == msg.key);
      unawaited(_save());
      return (sent: sent, permanentFailure: false);
    } on ApiException catch (e) {
      if (e.code == 'network' || e.code.startsWith('http_5')) return (sent: null, permanentFailure: false);
      // Sunucu isteği gördü ve kalıcı olarak reddetti (ör. engellendi, kısıtlandı): tekrar denemenin anlamı yok
      _pending.removeWhere((p) => p.key == msg.key);
      unawaited(_save());
      return (sent: null, permanentFailure: true);
    } catch (_) {
      return (sent: null, permanentFailure: false);
    }
  }

  // Bağlantı gelince (soket yeniden bağlanınca) veya sohbet ekranı açılınca: kuyruktaki her mesajı
  // sırayla (en eskiden başlayarak) dener.
  Future<List<({String key, SendOutcome outcome})>> flush() async {
    await _ensureLoaded();
    if (_flushing || _pending.isEmpty) return const [];
    _flushing = true;
    final results = <({String key, SendOutcome outcome})>[];
    try {
      for (final msg in List<_PendingMessage>.of(_pending)) {
        results.add((key: msg.key, outcome: await _attempt(msg)));
      }
    } finally {
      _flushing = false;
    }
    return results;
  }
}

final messageOutboxProvider = Provider<MessageOutbox>((ref) => MessageOutbox(ref.watch(apiProvider)));
