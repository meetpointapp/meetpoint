// Yer tutucu: Firebase henüz yapılandırılmadı.
// `flutterfire configure` komutu bu dosyayı gerçek ayarlarla değiştirir; o zamana kadar
// push bildirimleri kapalı kalır (uygulama açıkken gelen anlık uyarılar yine çalışır).
import 'package:firebase_core/firebase_core.dart';

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform =>
      throw UnsupportedError('Firebase yapılandırılmadı: flutterfire configure çalıştırın.');
}
