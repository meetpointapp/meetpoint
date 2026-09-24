import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:meetpoint/core/api.dart';
import 'package:meetpoint/core/auth_tokens.dart';

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

Api _api(_FakeNet net, {String? token = 'tok'}) =>
    Api(token == null ? null : AuthTokens.fixed(token), adapter: net, retryDelay: Duration.zero);

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

  group('Oturum yenileme', () {
    test('süresi dolan jeton: bir kez yenilenir, istek yeni jetonla aynı anahtarla tekrarlanır', () async {
      final saved = <String>[];
      final auth = AuthTokens('eski', 'r1', onChanged: (t) async => saved.add(t.refreshToken));
      final net = _FakeNet([
        _json(401, {'error': 'token_expired'}),
        _json(200, {'token': 'yeni', 'refreshToken': 'r2', 'userId': 'u'}),
        _json(200, {'balance': 7}),
      ]);
      expect(await Api(auth, adapter: net, retryDelay: Duration.zero).sendGift('c1', 'rose'), 7);
      expect(net.seen.map((o) => o.path), ['/calls/c1/gifts', '/auth/refresh', '/calls/c1/gifts']);
      expect(net.seen[1].data, {'refreshToken': 'r1'});
      expect(net.seen.last.headers['Authorization'], 'Bearer yeni');
      expect(net.keys.first, net.keys.last);
      expect(saved, ['r2']);
    });

    test('yenileme reddedilirse oturum kapanır', () async {
      String? invalid;
      final net = _FakeNet([
        _json(401, {'error': 'token_expired'}),
        _json(401, {'error': 'invalid_refresh'}),
      ]);
      final api = Api(AuthTokens('a', 'r'), adapter: net, retryDelay: Duration.zero, onSessionInvalid: (c) => invalid = c);
      await expectLater(api.calls(), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'invalid_refresh')));
      expect(invalid, 'invalid_token');
    });

    test('aynı anda süresi dolan iki istek tek yenileme yapar', () async {
      final auth = AuthTokens('a', 'r');
      var refreshes = 0;
      Future<({String token, String refreshToken})> call(String _) async {
        refreshes++;
        await Future<void>.delayed(const Duration(milliseconds: 10));
        return (token: 'b', refreshToken: 'r2');
      }

      await Future.wait([auth.refresh(call), auth.refresh(call)]);
      expect(refreshes, 1);
      expect(auth.access, 'b');
    });

    test('bitmek üzere olan jeton istekten önce yenilenir', () async {
      String jwt(int exp) => 'x.${base64Url.encode(utf8.encode(jsonEncode({'exp': exp}))).replaceAll('=', '')}.y';
      final soon = DateTime.now().add(const Duration(seconds: 20)).millisecondsSinceEpoch ~/ 1000;
      final later = DateTime.now().add(const Duration(minutes: 15)).millisecondsSinceEpoch ~/ 1000;
      expect(AuthTokens(jwt(later), 'r').expiresSoon, isFalse);
      final net = _FakeNet([
        _json(200, {'token': jwt(later), 'refreshToken': 'r2', 'userId': 'u'}),
        _json(200, <Object>[]),
      ]);
      await Api(AuthTokens(jwt(soon), 'r'), adapter: net).calls();
      expect(net.seen.map((o) => o.path), ['/auth/refresh', '/calls']);
    });
  });
}
