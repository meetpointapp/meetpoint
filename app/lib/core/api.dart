import 'dart:math';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

import 'auth_tokens.dart';
import 'config.dart';
import 'models.dart';

// Sunucunun döndürdüğü hata kodu (ör. "insufficient_balance")
class ApiException implements Exception {
  final String code;
  final int? status;
  // Sunucunun hata ile birlikte döndürdüğü ek bilgi (ör. {'kind': 'overseas_transfer'}, {'nextAt': ...})
  final Map<String, dynamic> data;
  const ApiException(this.code, [this.status, this.data = const {}]);
  @override
  String toString() => 'ApiException($code)';
}

// Tek oturum çifti (giriş/kayıt/yenileme yanıtı)
typedef IssuedTokens = ({String token, String refreshToken, String userId});

class Api {
  // onSessionInvalid: oturum geçersizleşince (çıkış yapıldı, şifre değişti, hesap yasaklandı) çağrılır.
  // adapter/retryDelay sadece testler için (sahte ağ, beklemesiz tekrar).
  Api(this._auth, {this.onSessionInvalid, HttpClientAdapter? adapter, this.retryDelay = const Duration(milliseconds: 600)})
      : _dio = Dio(BaseOptions(
          baseUrl: apiBaseUrl,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 20),
          headers: deviceHeaders,
        )) {
    if (adapter != null) _dio.httpClientAdapter = adapter;
  }

  // Cihaz bilgisi (açılışta bir kez doldurulur): sunucu "Cihazlarım" listesi ve yeni cihaz uyarısı için kullanır
  static Map<String, String> deviceHeaders = {};

  final Dio _dio;
  final AuthTokens? _auth;
  bool get _hasToken => _auth != null;
  final void Function(String code)? onSessionInvalid;
  final Duration retryDelay;

  static final _random = Random.secure();
  static String newIdempotencyKey() => List.generate(16, (_) => _random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();

  // Yanıt hiç gelmediyse (bağlantı koptu, zaman aşımı) istek sunucuda işlenmiş olabilir de olmayabilir de
  static bool _noResponse(DioException e) =>
      e.response == null &&
      const {
        DioExceptionType.connectionError,
        DioExceptionType.connectionTimeout,
        DioExceptionType.sendTimeout,
        DioExceptionType.receiveTimeout,
        DioExceptionType.unknown,
      }.contains(e.type);

  // Yazma istekleri (oturum açıkken): her eyleme benzersiz Idempotency-Key eklenir. Ağ koparsa aynı
  // anahtarla en fazla 2 kez tekrar denenir; sunucu isteği zaten işlediyse işlemi tekrarlamaz, ilk
  // yanıtı döndürür. Böylece zayıf bağlantıda hediye/mesaj/ödeme iki kez işlenmez, kaybolmaz da.
  // Kimlik uçları (/auth) bu korumayı desteklemez: tekrar denenmez.
  //
  // Erişim jetonu kısa ömürlü: bitmek üzereyse istekten önce, sunucu "token_expired" derse istekten
  // sonra bir kez yenilenip aynı istek tekrarlanır. Kullanıcı bunu hiç fark etmez.
  Future<dynamic> _send(Future<Response<dynamic>> Function(Options options) call, {bool write = false, String? path}) async {
    final idempotent = write && _hasToken && !(path?.startsWith('/auth/') ?? false);
    final key = idempotent ? newIdempotencyKey() : null;
    var refreshed = false;
    if (_auth?.expiresSoon ?? false) {
      await _refreshTokens();
      refreshed = true;
    }
    for (var attempt = 0;; attempt++) {
      final options = Options(headers: {
        if (_auth != null) 'Authorization': 'Bearer ${_auth.access}',
        'Idempotency-Key': ?key,
      });
      try {
        return (await call(options)).data;
      } on DioException catch (e) {
        final data = e.response?.data;
        final code = data is Map && data['error'] is String ? data['error'] as String : null;
        if (code == 'token_expired' && _hasToken && !refreshed) {
          await _refreshTokens();
          refreshed = true;
          attempt--;
          continue;
        }
        if (idempotent && attempt < 2 && (_noResponse(e) || code == 'request_in_progress')) {
          await Future<void>.delayed(retryDelay * (attempt + 1));
          continue;
        }
        if (code != null) {
          // banned / invalid_token: oturum biter; reconsent_required: yeniden onay ekranı açılır
          if (_hasToken && const {'banned', 'invalid_token', 'reconsent_required'}.contains(code)) onSessionInvalid?.call(code);
          throw ApiException(code, e.response?.statusCode, Map<String, dynamic>.from(data as Map));
        }
        if (e.response == null) throw const ApiException('network');
        throw ApiException('http_${e.response!.statusCode}', e.response!.statusCode);
      }
    }
  }

  // Yenileme jetonuyla yeni çift alır. Yenileme reddedilirse (oturum kapatılmış, jeton çalınmış olabilir)
  // oturum sonlanır.
  Future<void> _refreshTokens() async {
    final auth = _auth!;
    try {
      await auth.refresh((refreshToken) async {
        final r = await _dio.post('/auth/refresh', data: {'refreshToken': refreshToken});
        return (token: r.data['token'] as String, refreshToken: r.data['refreshToken'] as String);
      });
    } on DioException catch (e) {
      final data = e.response?.data;
      final code = data is Map && data['error'] is String ? data['error'] as String : null;
      if (code == 'invalid_refresh' || code == 'banned') {
        onSessionInvalid?.call(code == 'banned' ? 'banned' : 'invalid_token');
        throw ApiException(code!, e.response?.statusCode);
      }
      if (e.response == null) throw const ApiException('network');
      throw ApiException(code ?? 'http_${e.response!.statusCode}', e.response!.statusCode);
    }
  }

  // Anlık bağlantı için geçerli erişim jetonu (gerekirse önce yenilenir)
  Future<String?> freshAccessToken() async {
    if (_auth == null) return null;
    if (_auth.expiresSoon) await _refreshTokens();
    return _auth.access;
  }

  // Dosya yüklemelerinde gövde her denemede yeniden oluşturulur (FormData bir kez okunabilir)
  static Object? _body(Object? body) => body is FormData ? body.clone() : body;

  Future<dynamic> _get(String path, [Map<String, dynamic>? query]) =>
      _send((o) => _dio.get(path, queryParameters: query, options: o));
  Future<dynamic> _post(String path, [Object? body]) =>
      _send((o) => _dio.post(path, data: _body(body), options: o), write: true, path: path);
  Future<dynamic> _put(String path, [Object? body]) =>
      _send((o) => _dio.put(path, data: _body(body), options: o), write: true, path: path);
  Future<dynamic> _delete(String path, [Object? body]) =>
      _send((o) => _dio.delete(path, data: _body(body), options: o), write: true, path: path);

  // Kimlik
  IssuedTokens _tokenOf(dynamic r) =>
      (token: r['token'] as String, refreshToken: r['refreshToken'] as String, userId: r['userId'] as String);

  Future<IssuedTokens> login(String email, String password) async =>
      _tokenOf(await _post('/auth/login', {'email': email, 'password': password}));

  // Girişte hesap silinmeyi bekliyorsa geri gelir: restored = true
  Future<(IssuedTokens, bool)> loginWithStatus(String email, String password) async {
    final r = await _post('/auth/login', {'email': email, 'password': password});
    return (_tokenOf(r), r['restored'] == true);
  }

  Future<IssuedTokens> register(String email, String password, String locale, {bool overseas = false, bool marketing = false}) async =>
      _tokenOf(await _post('/auth/register', {
        'email': email,
        'password': password,
        'locale': locale,
        'acceptTerms': true,
        'consents': {'overseas': overseas, 'marketing': marketing},
      }));

  Future<void> verifyEmail(String code) => _post('/auth/verify-email', {'code': code});

  Future<void> resendCode() => _post('/auth/resend-code');

  Future<void> forgotPassword(String email) => _post('/auth/forgot-password', {'email': email});

  Future<IssuedTokens> resetPassword(String email, String code, String password) async =>
      _tokenOf(await _post('/auth/reset-password', {'email': email, 'code': code, 'password': password}));

  // Bu cihazdaki oturumu sunucuda da kapatır
  Future<void> logout() => _post('/auth/logout');

  Future<void> changePassword(String current, String next) =>
      _post('/auth/change-password', {'currentPassword': current, 'newPassword': next});

  // Cihazlarım: açık oturumlar
  Future<List<DeviceSession>> sessions() async =>
      [for (final s in (await _get('/me/sessions') as List)) DeviceSession.fromJson(s)];

  Future<void> revokeSession(String id) => _delete('/me/sessions/$id');

  Future<void> revokeOtherSessions() => _post('/me/sessions/revoke-others');

  // Gizlilik ve verilerim (KVKK)
  Future<ConsentState> consents() async => ConsentState.fromJson(await _get('/me/consents'));

  Future<ConsentState> setConsent(ConsentKind kind, bool granted, {String source = 'settings'}) async =>
      ConsentState.fromJson(await _put('/me/consents', {'kind': kind.api, 'granted': granted, 'source': source}));

  Future<void> acceptLegal() => _post('/me/consents/accept-legal');

  Future<DataExportInfo?> dataExport() async {
    final latest = (await _get('/me/data-export'))['latest'];
    return latest == null ? null : DataExportInfo.fromJson(latest);
  }

  Future<void> requestDataExport() => _post('/me/data-export');

  Future<List<KvkkRequest>> kvkkRequests() async =>
      [for (final r in (await _get('/me/kvkk-requests') as List)) KvkkRequest.fromJson(r)];

  // Moderasyon: yaptırım bildirimi görüldü, itiraz
  Future<void> sanctionSeen(String id) => _post('/me/sanctions/$id/seen');

  Future<void> appeal(String sanctionId, String message) => _post('/me/appeals', {'sanctionId': sanctionId, 'message': message});

  // Yasaklı kullanıcı (oturumu yok): girişte verilen itiraz anahtarıyla
  Future<void> appealBanned(String appealToken, String message) =>
      _post('/appeals', {'appealToken': appealToken, 'message': message});

  Future<void> sendKvkkRequest(String kind, String message) => _post('/me/kvkk-requests', {'kind': kind, 'message': message});

  Future<void> deleteAccount(String password) => _delete('/me', {'password': password});

  // Mavi tik: sunucu rastgele bir poz atar, kullanıcı o pozla selfie yükler
  Future<String> startVerification() async => (await _post('/me/verification/start'))['pose'] as String;

  Future<void> uploadSelfie(XFile file) async {
    final bytes = await file.readAsBytes();
    final name = file.name.isEmpty ? 'selfie.jpg' : file.name;
    final subtype = name.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    await _post('/me/verification', FormData.fromMap({
      'selfie': MultipartFile.fromBytes(bytes, filename: name, contentType: DioMediaType('image', subtype)),
    }));
  }

  // Profil
  Future<Me> me() async => Me.fromJson(await _get('/me'));

  Future<void> saveProfile(Map<String, dynamic> data) => _put('/me/profile', data);

  Future<void> setLocale(String locale) => _put('/me/locale', {'locale': locale});

  Future<Photo> uploadPhoto(XFile file) async {
    final name = file.name.isEmpty ? 'photo.jpg' : file.name;
    final ext = name.split('.').last.toLowerCase();
    final subtype = switch (ext) { 'png' => 'png', 'webp' => 'webp', 'heic' => 'heic', _ => 'jpeg' };
    final form = FormData.fromMap({
      'photo': MultipartFile.fromBytes(
        await file.readAsBytes(),
        filename: name,
        contentType: DioMediaType('image', subtype),
      ),
    });
    return Photo.fromJson(await _post('/me/photos', form));
  }

  Future<void> deletePhoto(String id) => _delete('/me/photos/$id');

  Future<void> reorderPhotos(List<String> ids) => _put('/me/photos/order', {'ids': ids});

  Future<PublicProfile> user(String id) async => PublicProfile.fromJson(await _get('/users/$id'));

  // Keşfet
  Future<List<PublicProfile>> discover() async =>
      [for (final p in (await _get('/discover') as List)) PublicProfile.fromJson(p)];

  // direction: like | pass | superlike (süper beğeni jetonla)
  Future<({bool match, String? conversationId})> swipe(String toId, String direction) async {
    final r = await _post('/swipes', {'toId': toId, 'direction': direction});
    return (match: r['match'] as bool, conversationId: r['conversationId'] as String?);
  }

  Future<void> updateLocation(double latitude, double longitude) =>
      _put('/me/location', {'latitude': latitude, 'longitude': longitude});

  Future<void> saveFilters(DiscoverFilters f) => _put('/me/filters', f.toJson());

  // Jetonla alınan özellikler
  Future<DateTime> boost() async => DateTime.parse((await _post('/boost'))['boostedUntil'] as String).toLocal();

  Future<LikesInfo> likes() async => LikesInfo.fromJson(await _get('/likes'));

  Future<void> unlockLikes() => _post('/likes/unlock');

  // Push bildirim cihazı
  Future<void> registerDevice(String token, String platform) =>
      _post('/me/devices', {'token': token, 'platform': platform});

  Future<void> unregisterDevice(String token) => _delete('/me/devices', {'token': token});

  // Cüzdan
  Future<WalletInfo> wallet() async => WalletInfo.fromJson(await _get('/wallet'));

  // Test modu satın alma (mağaza bağlı değilken); dönen değer: yüklenen jeton + bonus
  Future<({int coins, int bonus})> devTopUp(String packId) async {
    final r = await _post('/wallet/dev-topup', {'packId': packId});
    return (coins: r['coins'] as int, bonus: r['bonus'] as int);
  }

  // Mağaza satın alımından sonra: sunucu RevenueCat'ten eksik işlemleri çekip yükler
  Future<int> syncWallet() async => (await _post('/wallet/sync'))['credited'] as int;

  // İletişim istekleri
  Future<void> sendRequest(String toId, RequestKind kind, {String note = ''}) =>
      _post('/requests', {'toId': toId, 'kind': requestKindApi(kind), 'note': note});

  Future<List<ContactRequest>> requests({required bool inbox}) async => [
        for (final r in (await _get('/requests', {'box': inbox ? 'inbox' : 'outbox'}) as List))
          ContactRequest.fromJson(r),
      ];

  Future<String?> acceptRequest(String id) async =>
      (await _post('/requests/$id/accept'))['conversationId'] as String?;

  Future<void> rejectRequest(String id) => _post('/requests/$id/reject');

  Future<void> cancelRequest(String id) => _post('/requests/$id/cancel');

  // Para çekme
  Future<List<Payout>> payouts() async => [for (final p in (await _get('/payouts') as List)) Payout.fromJson(p)];

  Future<Payout> requestPayout({
    required int coins,
    required PayoutMethod method,
    required String accountName,
    required String accountValue,
  }) async =>
      Payout.fromJson(await _post('/payouts', {
        'coins': coins,
        'method': method.name,
        'accountName': accountName,
        'accountValue': accountValue,
      }));

  // Kimlik doğrulama (para çekme için): ad-soyad, TC, belge fotoğrafı
  Future<Map<String, dynamic>> kyc() async => Map<String, dynamic>.from(await _get('/me/kyc'));

  Future<void> submitKyc({required String fullName, required String tcNo, required XFile document}) async {
    final name = document.name.isEmpty ? 'kimlik.jpg' : document.name;
    final subtype = name.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    await _post('/me/kyc', FormData.fromMap({
      'fullName': fullName,
      'tcNo': tcNo,
      'document': MultipartFile.fromBytes(await document.readAsBytes(), filename: name, contentType: DioMediaType('image', subtype)),
    }));
  }

  Future<EarningsStatement> earnings(int year) async => EarningsStatement.fromJson(await _get('/me/earnings', {'year': year}));

  Future<void> cancelPayout(String id) => _post('/payouts/$id/cancel');

  // Aramalar
  Future<CallInfo> startCall(String toId, CallKind kind) async =>
      CallInfo.fromJson(await _post('/calls', {'toId': toId, 'kind': callKindApi(kind)}));

  Future<CallInfo> acceptCall(String id) async => CallInfo.fromJson(await _post('/calls/$id/accept'));

  // Çalarken arayan: iptal · aranan: ret · görüşmede: bitir
  Future<CallInfo> hangUp(String id) async => CallInfo.fromJson(await _post('/calls/$id/hangup'));

  Future<CallInfo> call(String id) async => CallInfo.fromJson(await _get('/calls/$id'));

  // Arama içinden "bildir ve kapat"
  Future<CallInfo> reportCall(String id, String reason) async =>
      CallInfo.fromJson(await _post('/calls/$id/report', {'reason': reason}));

  Future<List<CallInfo>> calls() async => [for (final c in (await _get('/calls') as List)) CallInfo.fromJson(c)];

  // Hediye gönder; kalan bakiyeyi döndürür
  Future<int> sendGift(String callId, String giftId) async =>
      (await _post('/calls/$callId/gifts', {'giftId': giftId}))['balance'] as int;

  Future<void> rateCall(String id, int rating, {String? reportReason}) =>
      _post('/calls/$id/rate', {'rating': rating, 'reportReason': ?reportReason});

  // Sohbet
  Future<List<Conversation>> conversations() async =>
      [for (final c in (await _get('/conversations') as List)) Conversation.fromJson(c)];

  // En yeni [pageSize] mesaj; beforeId verilirse o mesajdan daha eskiler (eskiden yeniye sıralı)
  static const messagePageSize = 50;
  Future<List<ChatMessage>> messages(String conversationId, {String? beforeId}) async => [
        for (final m in (await _get('/conversations/$conversationId/messages', {
          'limit': messagePageSize,
          'beforeId': ?beforeId,
        }) as List))
          ChatMessage.fromJson(m),
      ];

  Future<ChatMessage> sendMessage(String conversationId, String body) async =>
      ChatMessage.fromJson(await _post('/conversations/$conversationId/messages', {'body': body}));

  Future<void> markRead(String conversationId) => _post('/conversations/$conversationId/read');

  // Tek seferlik fotoğraf
  Future<ChatMessage> sendPhoto(String conversationId, XFile file) async {
    final name = file.name.isEmpty ? 'photo.jpg' : file.name;
    final subtype = name.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    final form = FormData.fromMap({
      'photo': MultipartFile.fromBytes(await file.readAsBytes(), filename: name, contentType: DioMediaType('image', subtype)),
    });
    return ChatMessage.fromJson(await _post('/conversations/$conversationId/photos', form));
  }

  // Fotoğrafı aç (sadece bir kez); baytlar bellekte gösterilir, cihaza kaydedilmez
  Future<Uint8List> openPhoto(String messageId) async {
    final data = await _send((o) => _dio.get<List<int>>('/messages/$messageId/photo',
        options: o.copyWith(responseType: ResponseType.bytes)));
    return Uint8List.fromList(data as List<int>);
  }

  // Güvenlik
  Future<void> block(String toId) => _post('/blocks', {'toId': toId});

  Future<void> report(String toId, String reason) => _post('/reports', {'toId': toId, 'reason': reason});
}
