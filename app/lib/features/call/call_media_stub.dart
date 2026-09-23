import 'call_media.dart';

// Web: gerçek ses/görüntü yok (tarayıcı sürümü sadece geliştirme ve önizleme için)
CallMediaEngine createMediaEngine() => simulatedMediaEngine();
