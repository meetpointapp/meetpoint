import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:meetpoint/core/api.dart';
import 'package:meetpoint/core/auth_tokens.dart';
import 'package:meetpoint/core/session.dart';
import 'package:meetpoint/features/chat/message_outbox.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Sahte ağ: her istek sıradaki adımı uygular (ağ hatası ya da yanıt). api_retry_test.dart'taki
// _FakeNet ile aynı fikir; burada ayrıca gönderilen Idempotency-Key'leri de kaydeder.
class _FakeNet implements HttpClientAdapter {
  _FakeNet(this.script);
  final List<Object> script;
  final List<RequestOptions> seen = [];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    seen.add(options);
    final step = script[seen.length - 1];
    if (step is DioExceptionType) throw DioException(requestOptions: options, type: step);
    return step as ResponseBody;
  }

  @override
  void close({bool force = false}) {}

  List<String?> get keys => [for (final o in seen) o.headers['Idempotency-Key'] as String?];
}

ResponseBody _json(int status, Object body) =>
    ResponseBody.fromString(jsonEncode(body), status, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });

ProviderContainer _container(_FakeNet net) {
  final api = Api(AuthTokens.fixed('tok'), adapter: net, retryDelay: Duration.zero);
  return ProviderContainer(overrides: [apiProvider.overrideWithValue(api)]);
}

Map<String, dynamic> _message(String id, {String body = 'merhaba'}) =>
    {'id': id, 'conversationId': 'c1', 'senderId': 'me', 'kind': 'text', 'body': body, 'createdAt': '2026-01-01T00:00:00.000Z'};

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('Çevrimdışı mesaj kuyruğu (Faz 15)', () {
    test('ağ hatasında kuyrukta kalır, tekrar denenince gönderilir', () async {
      // Api._send zaten aynı denemede en fazla 3 kez dener (Faz 9); dışarıdaki kuyruk denemesinin
      // gerçekten başarısız olması için bu iç tekrarların hepsi tükenmeli.
      final net = _FakeNet([
        DioExceptionType.connectionError,
        DioExceptionType.connectionError,
        DioExceptionType.connectionError,
        _json(201, _message('m1')),
      ]);
      final outbox = _container(net).read(messageOutboxProvider);

      final key = await outbox.enqueue('c1', 'merhaba');
      final first = await outbox.attempt(key);
      expect(first.sent, isNull);
      expect(first.permanentFailure, isFalse);
      expect(await outbox.pendingFor('c1', 'me'), hasLength(1));

      final results = await outbox.flush();
      expect(results, hasLength(1));
      expect(results.single.outcome.sent?.id, 'm1');
      expect(await outbox.pendingFor('c1', 'me'), isEmpty);

      // Tüm denemelerde (iç tekrarlar + kuyruğun kendi tekrar denemesi) AYNI anahtar gönderildi
      expect(net.keys, hasLength(4));
      expect(net.keys.first, isNotNull);
      expect(net.keys.toSet(), hasLength(1));
    });

    test('sunucu kalıcı reddederse (ör. engellendi) kuyruktan düşer, tekrar denenmez', () async {
      final net = _FakeNet([_json(403, {'error': 'blocked'})]);
      final outbox = _container(net).read(messageOutboxProvider);

      final key = await outbox.enqueue('c1', 'merhaba');
      final result = await outbox.attempt(key);
      expect(result.sent, isNull);
      expect(result.permanentFailure, isTrue);
      expect(await outbox.pendingFor('c1', 'me'), isEmpty);

      // Kuyrukta olmadığı için bir daha denenmesi no-op olmalı, yeni istek gitmemeli
      final again = await outbox.flush();
      expect(again, isEmpty);
      expect(net.seen, hasLength(1));
    });

    test('kuyruk kalıcıdır: uygulama yeniden başlasa (yeni MessageOutbox) da mesaj kaybolmaz', () async {
      final netA = _FakeNet(List.filled(3, DioExceptionType.connectionError));
      final outboxA = _container(netA).read(messageOutboxProvider);
      final key = await outboxA.enqueue('c1', 'kalıcı mesaj');
      await outboxA.attempt(key); // ağ yok, kuyrukta kalır (diske yazılmıştır)

      // "Uygulama yeniden başladı": aynı SharedPreferences durumunu paylaşan yepyeni bir MessageOutbox
      final netB = _FakeNet([_json(201, _message('m2', body: 'kalıcı mesaj'))]);
      final outboxB = _container(netB).read(messageOutboxProvider);
      final pendingAfterRestart = await outboxB.pendingFor('c1', 'me');
      expect(pendingAfterRestart, hasLength(1));
      expect(pendingAfterRestart.single.body, 'kalıcı mesaj');

      final flushed = await outboxB.flush();
      expect(flushed.single.outcome.sent?.id, 'm2');
      // Yeniden başlatma sonrası da AYNI anahtar kullanıldı
      expect(netB.keys.single, key);
    });

    test('birden fazla kuyruklu mesaj sırayla (en eskiden başlayarak) gönderilir', () async {
      final net = _FakeNet([_json(201, _message('m1', body: 'birinci')), _json(201, _message('m2', body: 'ikinci'))]);
      final outbox = _container(net).read(messageOutboxProvider);
      await outbox.enqueue('c1', 'birinci');
      await outbox.enqueue('c1', 'ikinci');

      final results = await outbox.flush();
      expect(results.map((r) => r.outcome.sent?.body), ['birinci', 'ikinci']);
    });
  });
}
