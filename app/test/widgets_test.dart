import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:meetpoint/core/theme.dart';
import 'package:meetpoint/core/ui.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: Center(child: child)));

void main() {
  group('GradientButton', () {
    testWidgets('etkinken dokunma çalışır', (tester) async {
      var taps = 0;
      await tester.pumpWidget(_wrap(GradientButton(label: 'Gönder', onPressed: () => taps++)));
      await tester.tap(find.text('Gönder'));
      expect(taps, 1);
    });

    testWidgets('onPressed yoksa devre dışı ve ekran okuyucuya bildirilir', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_wrap(const GradientButton(label: 'Gönder', onPressed: null)));
      expect(
        tester.getSemantics(find.bySemanticsLabel('Gönder')),
        matchesSemantics(isButton: true, hasEnabledState: true, isEnabled: false, label: 'Gönder'),
      );
      handle.dispose();
    });

    testWidgets('meşgulken ikinci dokunma engellenir', (tester) async {
      var taps = 0;
      await tester.pumpWidget(_wrap(GradientButton(label: 'Gönder', busy: true, onPressed: () => taps++)));
      await tester.tap(find.byType(GradientButton), warnIfMissed: false);
      expect(taps, 0);
    });
  });

  group('CoinAmount', () {
    testWidgets('işaretli gösterim', (tester) async {
      await tester.pumpWidget(_wrap(const Column(children: [CoinAmount(30, signed: true), CoinAmount(-90, signed: true), CoinAmount(5)])));
      expect(find.text('+30'), findsOneWidget);
      expect(find.text('-90'), findsOneWidget);
      expect(find.text('5'), findsOneWidget);
    });
  });
}
