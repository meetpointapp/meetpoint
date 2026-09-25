import 'package:shared_preferences/shared_preferences.dart';

// Faz 16: tek seferlik ipuçları. Hangi ipucunun görüldüğü diskte tutulur (message_outbox.dart'taki
// gibi), böylece uygulama yeniden başlasa da aynı ipucu bir daha gösterilmez.
class TipsStore {
  static const _prefsKey = 'seen_tips_v1';
  static Set<String>? _cache;

  static Future<Set<String>> _load() async {
    if (_cache != null) return _cache!;
    try {
      final prefs = await SharedPreferences.getInstance();
      _cache = (prefs.getStringList(_prefsKey) ?? const <String>[]).toSet();
    } catch (_) {
      _cache = <String>{};
    }
    return _cache!;
  }

  // İlk kez mi görülüyor? true dönerse ipucu artık görülmüş sayılır (bir daha true dönmez).
  static Future<bool> consumeFirstTime(String id) async {
    final seen = await _load();
    if (seen.contains(id)) return false;
    seen.add(id);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_prefsKey, seen.toList());
    } catch (_) {}
    return true;
  }
}
