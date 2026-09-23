import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

// Jeton satın alma (RevenueCat → App Store / Google Play).
// Anahtarlar derleme sırasında verilir:
//   flutter run --dart-define=REVENUECAT_ANDROID_KEY=goog_xxx --dart-define=REVENUECAT_IOS_KEY=appl_xxx
// Anahtar yoksa veya web'deyse mağaza kapalıdır; cüzdan test moduna geçer.
const _androidKey = String.fromEnvironment('REVENUECAT_ANDROID_KEY');
const _iosKey = String.fromEnvironment('REVENUECAT_IOS_KEY');

class StoreUnavailable implements Exception {}

class CoinStore {
  CoinStore._();
  static final instance = CoinStore._();

  bool _configured = false;
  String? _userId;
  final Map<String, StoreProduct> _products = {};

  String get _key => defaultTargetPlatform == TargetPlatform.iOS ? _iosKey : _androidKey;

  bool get available => !kIsWeb && _key.isNotEmpty;

  // Mağaza hesabını bizim kullanıcı kimliğimize bağla (webhook'ta app_user_id = userId)
  Future<void> login(String userId) async {
    if (!available || _userId == userId) return;
    try {
      if (!_configured) {
        await Purchases.configure(PurchasesConfiguration(_key)..appUserID = userId);
        _configured = true;
      } else {
        await Purchases.logIn(userId);
      }
      _userId = userId;
    } catch (e) {
      debugPrint('store login failed: $e');
    }
  }

  Future<void> logout() async {
    if (!_configured) return;
    _userId = null;
    await Purchases.logOut().then((_) {}, onError: (_) {});
  }

  // Mağazanın yerel fiyatları (ör. "₺499,99"); ürün kimliği → fiyat metni
  Future<Map<String, String>> localPrices(List<String> productIds) async {
    if (!available) return {};
    final products = await Purchases.getProducts(productIds, productCategory: ProductCategory.nonSubscription);
    for (final p in products) {
      _products[p.identifier] = p;
    }
    return {for (final p in products) p.identifier: p.priceString};
  }

  // true: satın alındı · false: kullanıcı vazgeçti
  Future<bool> buy(String productId) async {
    var product = _products[productId];
    if (product == null) {
      await localPrices([productId]);
      product = _products[productId];
    }
    if (product == null) throw StoreUnavailable();
    try {
      await Purchases.purchase(PurchaseParams.storeProduct(product));
      return true;
    } on PlatformException catch (e) {
      if (PurchasesErrorHelper.getErrorCode(e) == PurchasesErrorCode.purchaseCancelledError) return false;
      rethrow;
    }
  }
}
