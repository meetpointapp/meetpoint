import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api.dart';

const _storage = FlutterSecureStorage();

class Session {
  final String? token;
  final String? userId;
  final bool emailVerified;
  final bool hasProfile;
  // Oturum kapandıysa sebebi (ör. "banned"): giriş ekranında gösterilir
  final String? notice;

  const Session({this.token, this.userId, this.emailVerified = false, this.hasProfile = false, this.notice});

  bool get isLoggedIn => token != null;

  Session copyWith({bool? emailVerified, bool? hasProfile}) => Session(
        token: token,
        userId: userId,
        emailVerified: emailVerified ?? this.emailVerified,
        hasProfile: hasProfile ?? this.hasProfile,
      );
}

class SessionNotifier extends AsyncNotifier<Session> {
  @override
  Future<Session> build() async {
    final token = await _storage.read(key: 'token');
    if (token == null) return const Session();
    try {
      return await _load(token);
    } on ApiException catch (e) {
      // Süresi dolmuş/geçersiz oturum veya yasaklı hesap: çıkış yap. Ağ hatası ise hatayı göster.
      if (e.status == 401 || e.code == 'banned') {
        await _storage.delete(key: 'token');
        return Session(notice: e.code == 'banned' ? 'banned' : null);
      }
      rethrow;
    }
  }

  Future<Session> _load(String token) async {
    final me = await Api(token).me();
    return Session(token: token, userId: me.id, emailVerified: me.emailVerified, hasProfile: me.profile != null);
  }

  Future<void> login(String email, String password) => _signIn(() => Api(null).login(email, password));

  Future<void> register(String email, String password, String locale) =>
      _signIn(() => Api(null).register(email, password, locale));

  Future<void> resetPassword(String email, String code, String password) =>
      _signIn(() => Api(null).resetPassword(email, code, password));

  Future<void> _signIn(Future<({String token, String userId})> Function() call) async {
    final r = await call();
    await _storage.write(key: 'token', value: r.token);
    state = AsyncData(await _load(r.token));
  }

  void emailVerified() => _update((s) => s.copyWith(emailVerified: true));

  void profileCompleted() => _update((s) => s.copyWith(hasProfile: true));

  void _update(Session Function(Session) f) {
    final s = state.value;
    if (s != null) state = AsyncData(f(s));
  }

  // Sunucu oturumu reddetti (yasaklandı / şifre başka cihazda değişti)
  Future<void> expire(String code) async {
    if (!(state.value?.isLoggedIn ?? false)) return;
    await _storage.delete(key: 'token');
    state = AsyncData(Session(notice: code == 'banned' ? 'banned' : null));
  }

  Future<void> logout() async {
    await _storage.delete(key: 'token');
    state = const AsyncData(Session());
  }
}

final sessionProvider = AsyncNotifierProvider<SessionNotifier, Session>(SessionNotifier.new);

final apiProvider = Provider<Api>((ref) => Api(
      ref.watch(sessionProvider.select((s) => s.value?.token)),
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
