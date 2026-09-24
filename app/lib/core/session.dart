import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api.dart';
import 'auth_tokens.dart';

const _storage = FlutterSecureStorage();

// Kalıcı depodaki anahtarlar
const _accessKey = 'token';
const _refreshKey = 'refresh_token';
const _deviceKey = 'device_id';

class Session {
  // Oturum boyunca aynı nesne: jeton yenilemesi oturumu (ve ona bağlı bağlantıları) baştan kurmaz
  final AuthTokens? auth;
  final String? userId;
  final bool emailVerified;
  final bool hasProfile;
  // Kullanım koşulları / aydınlatma metni değişti: yeniden onay ekranı gösterilir
  final bool needsLegal;
  // Oturum kapandıysa sebebi (ör. "banned"): giriş ekranında gösterilir
  final String? notice;

  const Session({this.auth, this.userId, this.emailVerified = false, this.hasProfile = false, this.needsLegal = false, this.notice});

  bool get isLoggedIn => auth != null;

  Session copyWith({bool? emailVerified, bool? hasProfile, bool? needsLegal}) => Session(
        auth: auth,
        userId: userId,
        emailVerified: emailVerified ?? this.emailVerified,
        hasProfile: hasProfile ?? this.hasProfile,
        needsLegal: needsLegal ?? this.needsLegal,
      );
}

class SessionNotifier extends AsyncNotifier<Session> {
  @override
  Future<Session> build() async {
    await _initDevice();
    final access = await _storage.read(key: _accessKey);
    final refresh = await _storage.read(key: _refreshKey);
    // Eski sürümden kalan tek jeton (yenileme jetonu yok): yeniden giriş gerekir
    if (access == null || refresh == null) {
      if (access != null) await _clearTokens();
      return const Session();
    }
    try {
      return await _load(_tokens(access, refresh));
    } on ApiException catch (e) {
      // Kapatılmış/geçersiz oturum veya yasaklı hesap: çıkış yap. Ağ hatası ise hatayı göster.
      if (e.status == 401 || e.code == 'banned') {
        await _clearTokens();
        return Session(notice: e.code == 'banned' ? 'banned' : null);
      }
      rethrow;
    }
  }

  // Kurulum kimliği ve cihaz adı her istekte gönderilir (Cihazlarım, yeni cihaz uyarısı)
  static Future<void> _initDevice() async {
    if (Api.deviceHeaders.isNotEmpty) return;
    var id = await _storage.read(key: _deviceKey);
    if (id == null) {
      id = newDeviceId();
      await _storage.write(key: _deviceKey, value: id);
    }
    Api.deviceHeaders = {'X-Device-Id': id, 'X-Device-Name': deviceLabel, 'X-Platform': platformName};
  }

  static AuthTokens _tokens(String access, String refresh) => AuthTokens(access, refresh, onChanged: (t) async {
        await _storage.write(key: _accessKey, value: t.access);
        await _storage.write(key: _refreshKey, value: t.refreshToken);
      });

  static Future<void> _clearTokens() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }

  Future<Session> _load(AuthTokens auth) async {
    final me = await Api(auth).me();
    return Session(
      auth: auth,
      userId: me.id,
      emailVerified: me.emailVerified,
      hasProfile: me.profile != null,
      needsLegal: me.legalUpdates.isNotEmpty,
    );
  }

  // true: hesap silinmeyi bekliyordu ve geri yüklendi
  Future<bool> login(String email, String password) async {
    var restored = false;
    await _signIn(() async {
      final (tokens, wasRestored) = await Api(null).loginWithStatus(email, password);
      restored = wasRestored;
      return tokens;
    });
    return restored;
  }

  Future<void> register(String email, String password, String locale, {bool overseas = false, bool marketing = false}) =>
      _signIn(() => Api(null).register(email, password, locale, overseas: overseas, marketing: marketing));

  Future<void> resetPassword(String email, String code, String password) =>
      _signIn(() => Api(null).resetPassword(email, code, password));

  Future<void> _signIn(Future<IssuedTokens> Function() call) async {
    await _initDevice();
    final r = await call();
    final auth = _tokens(r.token, r.refreshToken);
    await auth.onChanged!(auth);
    state = AsyncData(await _load(auth));
  }

  void emailVerified() => _update((s) => s.copyWith(emailVerified: true));

  void profileCompleted() => _update((s) => s.copyWith(hasProfile: true));

  void legalAccepted() => _update((s) => s.copyWith(needsLegal: false));

  void _update(Session Function(Session) f) {
    final s = state.value;
    if (s != null) state = AsyncData(f(s));
  }

  // Sunucu oturumu reddetti (yasaklandı / şifre başka cihazda değişti)
  Future<void> expire(String code) async {
    if (!(state.value?.isLoggedIn ?? false)) return;
    if (code == 'reconsent_required') return _update((s) => s.copyWith(needsLegal: true));
    await _clearTokens();
    state = AsyncData(Session(notice: code == 'banned' ? 'banned' : null));
  }

  // Sunucudaki oturum da kapatılır (ağ yoksa sadece bu cihazda; oturum 60 gün sonra kendiliğinden düşer)
  Future<void> logout() async {
    final auth = state.value?.auth;
    if (auth != null) await Api(auth).logout().timeout(const Duration(seconds: 5)).catchError((_) {});
    await _clearTokens();
    state = const AsyncData(Session());
  }
}

final sessionProvider = AsyncNotifierProvider<SessionNotifier, Session>(SessionNotifier.new);

final apiProvider = Provider<Api>((ref) => Api(
      ref.watch(sessionProvider.select((s) => s.value?.auth)),
      onSessionInvalid: (code) => ref.read(sessionProvider.notifier).expire(code),
    ));

// Uygulama dili: varsayılan Türkçe, seçim cihazda saklanır.
const supportedLanguages = ['tr', 'en'];

class LocaleNotifier extends Notifier<Locale> {
  @override
  Locale build() {
    _load();
    return const Locale('tr');
  }

  Future<void> _load() async {
    final saved = await _storage.read(key: 'locale');
    if (saved != null && supportedLanguages.contains(saved)) state = Locale(saved);
  }

  Future<void> set(String code) async {
    state = Locale(code);
    await _storage.write(key: 'locale', value: code);
    final api = ref.read(apiProvider);
    if (ref.read(sessionProvider).value?.isLoggedIn ?? false) {
      await api.setLocale(code).catchError((_) {});
    }
  }
}

final localeProvider = NotifierProvider<LocaleNotifier, Locale>(LocaleNotifier.new);
