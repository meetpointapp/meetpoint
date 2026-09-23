import 'package:geolocator/geolocator.dart';

import 'api.dart';

// Konumu alıp sunucuya gönderir (düşük hassasiyet yeterli; sunucu ~1 km'ye yuvarlar).
// ask=false ise sadece izin zaten verilmişse çalışır (sessiz yenileme).
Future<bool> syncLocation(Api api, {bool ask = false}) async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied && ask) permission = await Geolocator.requestPermission();
    if (permission != LocationPermission.always && permission != LocationPermission.whileInUse) return false;
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.low, timeLimit: Duration(seconds: 15)),
    );
    await api.updateLocation(pos.latitude, pos.longitude);
    return true;
  } catch (_) {
    return false;
  }
}
