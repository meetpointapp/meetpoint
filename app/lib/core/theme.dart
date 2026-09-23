import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// MeetPoint marka kimliği: sıcak mercan -> turuncu gradyan, Inter yazı tipi,
// yuvarlak köşeler ve dolgulu (çerçevesiz) alanlarla sade, kompakt bir görünüm.
abstract final class Brand {
  static const coral = Color(0xFFFF4D6D);
  static const orange = Color(0xFFFF8A5B);
  static const gold = Color(0xFFF5A524);
  static const like = Color(0xFF2BD47D);
  static const nope = Color(0xFFFF5A5F);

  static const gradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [coral, orange],
  );

  static const radius = 16.0;
}

ThemeData buildTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: Brand.coral,
    brightness: brightness,
    primary: Brand.coral,
    secondary: Brand.orange,
    surface: dark ? const Color(0xFF16121A) : const Color(0xFFFFFBFA),
  );
  final base = ThemeData(colorScheme: scheme, useMaterial3: true, brightness: brightness);
  final text = GoogleFonts.interTextTheme(base.textTheme).copyWith(
    headlineMedium: GoogleFonts.inter(textStyle: base.textTheme.headlineMedium, fontWeight: FontWeight.w800, letterSpacing: -0.5),
    headlineSmall: GoogleFonts.inter(textStyle: base.textTheme.headlineSmall, fontWeight: FontWeight.w800, letterSpacing: -0.3),
    titleLarge: GoogleFonts.inter(textStyle: base.textTheme.titleLarge, fontWeight: FontWeight.w700),
    titleMedium: GoogleFonts.inter(textStyle: base.textTheme.titleMedium, fontWeight: FontWeight.w600),
  );
  final field = dark ? const Color(0xFF241E28) : const Color(0xFFF5EEEE);
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(Brand.radius));

  return base.copyWith(
    textTheme: text,
    scaffoldBackgroundColor: scheme.surface,
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      titleTextStyle: text.titleLarge?.copyWith(color: scheme.onSurface, fontWeight: FontWeight.w800),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: field,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(Brand.radius), borderSide: BorderSide.none),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Brand.radius), borderSide: BorderSide.none),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Brand.radius),
        borderSide: const BorderSide(color: Brand.coral, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        // Karanlık modda da marka rengi + beyaz yazı
        backgroundColor: Brand.coral,
        foregroundColor: Colors.white,
        minimumSize: const Size(64, 48),
        textStyle: text.titleMedium,
        shape: const StadiumBorder(),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(minimumSize: const Size(64, 48), shape: const StadiumBorder()),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: dark ? const Color(0xFF1F1A23) : Colors.white,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      margin: EdgeInsets.zero,
    ),
    chipTheme: ChipThemeData(
      shape: const StadiumBorder(),
      side: BorderSide.none,
      backgroundColor: field,
      selectedColor: Brand.coral.withValues(alpha: dark ? 0.35 : 0.15),
      labelStyle: text.labelLarge,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 64,
      backgroundColor: dark ? const Color(0xFF1B161F) : Colors.white,
      indicatorColor: Brand.coral.withValues(alpha: 0.15),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysHide,
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(color: s.contains(WidgetState.selected) ? Brand.coral : scheme.onSurfaceVariant),
      ),
    ),
    dialogTheme: DialogThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24))),
    bottomSheetTheme: const BottomSheetThemeData(
      showDragHandle: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    ),
    snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, shape: shape),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
  );
}

// Gradyanlı ana buton (en önemli eylemler için: devam et, eşleşme vb.)
class GradientButton extends StatelessWidget {
  const GradientButton({super.key, required this.label, required this.onPressed, this.busy = false, this.icon});
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      onTap: enabled ? onPressed : null,
      child: _buildButton(context, enabled),
    );
  }

  Widget _buildButton(BuildContext context, bool enabled) {
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 200),
      opacity: enabled ? 1 : 0.45,
      child: DecoratedBox(
        decoration: const ShapeDecoration(shape: StadiumBorder(), gradient: Brand.gradient),
        child: Material(
          color: Colors.transparent,
          shape: const StadiumBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: enabled ? onPressed : null,
            child: SizedBox(
              height: 52,
              child: Center(
                child: busy
                    ? const SizedBox.square(
                        dimension: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                      )
                    : Row(mainAxisSize: MainAxisSize.min, children: [
                        if (icon != null) ...[Icon(icon, color: Colors.white, size: 20), const SizedBox(width: 8)],
                        Text(
                          label,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white),
                        ),
                      ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// Gradyan renkli logo yazısı
class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.size = 24, this.light = false});
  final double size;
  final bool light;

  @override
  Widget build(BuildContext context) {
    final style = GoogleFonts.inter(fontSize: size, fontWeight: FontWeight.w900, letterSpacing: -size * 0.04);
    final text = Text('meetpoint', style: style.copyWith(color: Colors.white));
    if (light) return text;
    return ShaderMask(
      shaderCallback: (r) => Brand.gradient.createShader(r),
      blendMode: BlendMode.srcIn,
      child: text,
    );
  }
}
