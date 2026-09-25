import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';

class _IntroPage {
  final IconData icon;
  final String title;
  final String body;
  const _IntroPage({required this.icon, required this.title, required this.body});
}

List<_IntroPage> _pages(AppLocalizations l) => [
      _IntroPage(icon: Icons.style_rounded, title: l.introPage1Title, body: l.introPage1Body),
      _IntroPage(icon: Icons.mail_rounded, title: l.introPage2Title, body: l.introPage2Body),
      _IntroPage(icon: Icons.toll_rounded, title: l.introPage3Title, body: l.introPage3Body),
      _IntroPage(icon: Icons.savings_rounded, title: l.introPage4Title, body: l.introPage4Body(14)),
    ];

// "Nasıl çalışır?" tanıtımı: keşfet, istek, jeton ve kazanç kısaca anlatılır. İlk profil
// kurulumundan sonra bir kez otomatik açılır; Profil ekranından her zaman tekrar açılabilir.
Future<void> showIntro(BuildContext context) {
  return Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder<void>(
      opaque: true,
      transitionDuration: const Duration(milliseconds: 250),
      transitionsBuilder: (_, anim, _, child) => FadeTransition(opacity: anim, child: child),
      pageBuilder: (_, _, _) => const _IntroScreen(),
    ),
  );
}

class _IntroScreen extends StatefulWidget {
  const _IntroScreen();

  @override
  State<_IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends State<_IntroScreen> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final pages = _pages(l);
    final last = _index == pages.length - 1;

    return Scaffold(
      body: SafeArea(
        child: Column(children: [
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 12, 0),
              child: TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(l.skip)),
            ),
          ),
          Expanded(
            child: PageView(
              controller: _controller,
              onPageChanged: (i) => setState(() => _index = i),
              children: [for (final p in pages) _IntroPageView(page: p)],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
            child: Column(children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < pages.length; i++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: i == _index ? 20 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(3),
                        color: i == _index ? Brand.coral : Brand.coral.withValues(alpha: 0.2),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: GradientButton(
                  label: last ? l.understood : l.nextStep,
                  onPressed: () {
                    if (last) {
                      Navigator.of(context).pop();
                    } else {
                      _controller.nextPage(duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
                    }
                  },
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _IntroPageView extends StatelessWidget {
  const _IntroPageView({required this.page});
  final _IntroPage page;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          width: 108,
          height: 108,
          decoration: const BoxDecoration(shape: BoxShape.circle, gradient: Brand.gradient),
          child: Icon(page.icon, color: Colors.white, size: 48),
        ),
        const SizedBox(height: 32),
        Text(page.title, textAlign: TextAlign.center, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        Text(page.body,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
      ]),
    );
  }
}
