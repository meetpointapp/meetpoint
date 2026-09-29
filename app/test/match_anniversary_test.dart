// Faz 17 madde 6: eşleşme yıldönümü — takvim günü bazında 1 hafta/1 ay/3 ay/6 ay ve her yıl
// dönümünde tetiklenmeli, diğer günlerde null dönmeli.
import 'package:flutter_test/flutter_test.dart';
import 'package:meetpoint/features/chat/chat_screen.dart';

void main() {
  group('matchAnniversaryDays (Faz 17)', () {
    final start = DateTime(2026, 1, 1, 14, 30);

    test('1 hafta sonra 7 döner', () {
      expect(matchAnniversaryDays(start, now: DateTime(2026, 1, 8, 9)), 7);
    });

    test('1 ay (30 gün) sonra 30 döner', () {
      expect(matchAnniversaryDays(start, now: DateTime(2026, 1, 31)), 30);
    });

    test('3 ay (90 gün) sonra 90 döner', () {
      expect(matchAnniversaryDays(start, now: start.add(const Duration(days: 90))), 90);
    });

    test('6 ay (180 gün) sonra 180 döner', () {
      expect(matchAnniversaryDays(start, now: start.add(const Duration(days: 180))), 180);
    });

    test('1 yıl (365 gün) sonra 365 döner', () {
      expect(matchAnniversaryDays(start, now: start.add(const Duration(days: 365))), 365);
    });

    test('2 yıl (730 gün) sonra 730 döner', () {
      expect(matchAnniversaryDays(start, now: start.add(const Duration(days: 730))), 730);
    });

    test('dönüm günü olmayan bir günde null döner', () {
      expect(matchAnniversaryDays(start, now: start.add(const Duration(days: 8))), isNull);
    });

    test('saat farkı görmezden gelinir (takvim günü esas)', () {
      // Eşleşme günün sonunda, ziyaret 7. günün başında — yine de 7. gün sayılır
      final lateStart = DateTime(2026, 1, 1, 23, 55);
      expect(matchAnniversaryDays(lateStart, now: DateTime(2026, 1, 8, 0, 5)), 7);
    });
  });
}
