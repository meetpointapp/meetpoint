import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:meetpoint/core/api.dart';

// Sahte ağ: her istek sıradaki adımı uygular (ağ hatası ya da yanıt)
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

Api _api(_FakeNet net, {String? token = 'tok'}) => Api(token, adapter: net, retryDelay: Duration.zero);

void main() {
  group('Tekrar gönderilen istek koruması (uygulama)', () {
    test('ağ koparsa aynı anahtarla tekrar dener ve sonucu döndürür', () async {
      final net = _FakeNet([DioExceptionType.connectionError, _json(200, {'balance': 950})]);
      expect(await _api(net).sendGift('c1', 'heart'), 950);
      expect(net.seen, hasLength(2));
      expect(net.keys.first, isNotNull);
      expect(net.keys.first, net.keys.last);
    });

    test('yanıt gelmeden zaman aşımı: aynı anahtarla tekrar (sunucu işlediyse ilk yanıtı döner)', () async {
      final net = _FakeNet([DioExceptionType.receiveTimeout, _json(200, {'balance': 950})]);
      expect(await _api(net).sendGift('c1', 'heart'), 950);
      expect(net.keys.toSet(), hasLength(1));
    });

    test('"işleniyor" yanıtında bekleyip aynı anahtarla tekrar', () async {
      final net = _FakeNet([
        _json(409, {'error': 'request_in_progress'}),
        _json(200, {'balance': 950}),
      ]);
      expect(await _api(net).sendGift('c1', 'heart'), 950);
      expect(net.keys.toSet(), hasLength(1));
    });

    test('en fazla 3 deneme, sonra ağ hatası', () async {
      final net = _FakeNet(List.filled(5, DioExceptionType.connectionError));
      await expectLater(_api(net).sendGift('c1', 'heart'), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'network')));
      expect(net.seen, hasLength(3));
    });

    test('sunucu hatası cevabında (ör. yetersiz bakiye) tekrar denenmez', () async {
      final net = _FakeNet([_json(402, {'error': 'insufficient_balance'})]);
      await expectLater(
          _api(net).sendGift('c1', 'heart'), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'insufficient_balance')));
      expect(net.seen, hasLength(1));
    });

    test('her yeni eylem yeni anahtar alır', () async {
      final net = _FakeNet([_json(200, {'balance': 1}), _json(200, {'balance': 2})]);
      final api = _api(net);
      await api.sendGift('c1', 'rose');
      await api.sendGift('c1', 'rose');
      expect(net.keys.toSet(), hasLength(2));
    });

    test('okuma isteklerine anahtar eklenmez ve tekrar denenmez', () async {
      final net = _FakeNet([DioExceptionType.connectionError]);
      await expectLater(_api(net).calls(), throwsA(isA<ApiException>()));
      expect(net.seen, hasLength(1));
      expect(net.keys.single, isNull);
    });

    test('giriş/kayıt uçlarında anahtar yok, tekrar yok (bu uçlar desteklemez)', () async {
      final net = _FakeNet([DioExceptionType.connectionError]);
      await expectLater(_api(net, token: null).login('a@b.c', 'x'), throwsA(isA<ApiException>()));
      expect(net.seen, hasLength(1));
      expect(net.keys.single, isNull);
    });

    test('anahtar biçimi sunucunun beklediği gibi (32 onaltılık karakter)', () {
      expect(Api.newIdempotencyKey(), matches(RegExp(r'^[0-9a-f]{32}$')));
    });
  });
}
