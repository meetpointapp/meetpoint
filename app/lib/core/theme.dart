import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'fx.dart';

// VibeUpMe marka kimliği: sıcak mercan -> turuncu gradyan, Inter yazı tipi,
// yuvarlak köşeler ve dolgulu (çerçevesiz) alanlarla sade, kompakt bir görünüm.
// Faz 20: premium (ve ücretsiz) temanın tam paleti — sadece ana renk değil sayfa zemini, kart yüzeyi ve
// aydınlık/karanlık da değişir. null palet = standart tema (beyaz zemin, mercan-turuncu vurgu).
class AppPalette {
  const AppPalette({required this.accent, this.background, this.surface, this.dark = false, this.glowA, this.glowB});
  final Color accent; // düğmeler, vurgular, gradyan
  final Color? background; // sayfa zemini
  final Color? surface; // kart / alt menü yüzeyi
  final bool dark; // sistem temasından bağımsız koyu tema
  final Color? glowA; // zemindeki iki yumuşak ışık
  final Color? glowB;
}

abstract final class Brand {
  static const _defaultCoral = Color(0xFFFF4D6D);
  static const _defaultOrange = Color(0xFFFF8A5B);
  static Color _coral = _defaultCoral;
  static Color _orange = _defaultOrange;

  // Faz 20: uygulamanın ana rengi kullanıcının seçtiği (ya da mağazadan aldığı) temaya göre değişir.
  // Varsayılan mercan→turuncu; tema seçilince main.dart setAccent() çağırır ve ağacı yeniden kurar.
  static Color get coral => _coral;
  static Color get orange => _orange;
  static const gold = Color(0xFFF5A524);
  static const like = Color(0xFF2BD47D);
  static const nope = Color(0xFFFF5A5F);

  static LinearGradient get gradient => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [_coral, _orange],
      );

  static const radius = 16.0;

  // Aktif tam tema paleti (null = standart beyaz tema)
  static AppPalette? _palette;
  static AppPalette? get palette => _palette;

  // Gradyanlı/dolu düğmelerin üstündeki yazı rengi: açık renkli vurguda (ör. altın) koyu, aksi hâlde beyaz
  static Color get onAccent => (_coral.computeLuminance() + _orange.computeLuminance()) / 2 > 0.40 ? const Color(0xFF1B1400) : Colors.white;

  static void setPalette(AppPalette? p) {
    _palette = p;
    setAccent(p?.accent);
  }

  // accent null = varsayılan marka rengi. İkinci renk, ana rengin tonunu biraz kaydırıp açarak türetilir.
  static void setAccent(Color? accent) {
    if (accent == null) {
      _coral = _defaultCoral;
      _orange = _defaultOrange;
      return;
    }
    final hsl = HSLColor.fromColor(accent);
    _coral = accent;
    // Sarı-yeşil aralığında (altın gibi) +22° limona kaçar: o tonlarda turuncuya doğru kaydır
    final warm = hsl.hue >= 35 && hsl.hue <= 110;
    final hue = (hsl.hue + (warm ? -20 : 22) + 360) % 360;
    _orange = hsl.withHue(hue).withLightness((hsl.lightness + (warm ? 0.0 : 0.08)).clamp(0.0, 0.85)).toColor();
  }
}

ThemeData buildTheme(Brightness systemBrightness) {
  // Tam tema seçiliyse onun aydınlık/karanlık tercihi sistem temasını geçer
  final palette = Brand.palette;
  final dark = palette?.dark ?? (systemBrightness == Brightness.dark);
  final brightness = dark ? Brightness.dark : Brightness.light;
  final background = palette?.background ?? (dark ? const Color(0xFF130F17) : Colors.white);
  final surfaceColor = palette?.surface ?? (dark ? const Color(0xFF1F1A23) : Colors.white);
  final scheme = ColorScheme.fromSeed(
    seedColor: Brand.coral,
    brightness: brightness,
    primary: Brand.coral,
    secondary: Brand.orange,
    surface: background,
  );
  final base = ThemeData(colorScheme: scheme, useMaterial3: true, brightness: brightness);
  final text = GoogleFonts.interTextTheme(base.textTheme).copyWith(
    headlineMedium: GoogleFonts.inter(textStyle: base.textTheme.headlineMedium, fontWeight: FontWeight.w800, letterSpacing: -0.5),
    headlineSmall: GoogleFonts.inter(textStyle: base.textTheme.headlineSmall, fontWeight: FontWeight.w800, letterSpacing: -0.3),
    titleLarge: GoogleFonts.inter(textStyle: base.textTheme.titleLarge, fontWeight: FontWeight.w700),
    titleMedium: GoogleFonts.inter(textStyle: base.textTheme.titleMedium, fontWeight: FontWeight.w600),
  );
  final field = dark ? Color.lerp(surfaceColor, Colors.white, 0.08)! : (palette == null ? const Color(0xFFF3F3F5) : Color.lerp(const Color(0xFFF3F3F5), Brand.coral, 0.07)!);
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(Brand.radius));

  return base.copyWith(
    textTheme: text,
    scaffoldBackgroundColor: background,
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
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
        borderSide: BorderSide(color: Brand.coral, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        // Karanlık modda da marka rengi + beyaz yazı
        backgroundColor: Brand.coral,
        foregroundColor: Brand.onAccent,
        minimumSize: const Size(64, 48),
        textStyle: text.titleMedium,
        shape: const StadiumBorder(),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(minimumSize: const Size(64, 48), shape: const StadiumBorder()),
    ),
    cardTheme: CardThemeData(
      // Yumuşak, hafif renkli gölge: düz görünen kartlara derinlik verir
      elevation: dark ? 0 : 2,
      shadowColor: palette == null ? Colors.black.withValues(alpha: 0.14) : Brand.coral.withValues(alpha: 0.22),
      color: surfaceColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: (dark ? Colors.white : Colors.black).withValues(alpha: dark ? 0.07 : 0.06)),
      ),
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
      height: 68,
      elevation: 12,
      shadowColor: Brand.coral.withValues(alpha: 0.4),
      surfaceTintColor: Colors.transparent,
      backgroundColor: surfaceColor,
      indicatorShape: const StadiumBorder(),
      indicatorColor: Brand.coral.withValues(alpha: 0.16),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysHide,
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(color: s.contains(WidgetState.selected) ? Brand.coral : scheme.onSurfaceVariant),
      ),
    ),
    // Diyalog ve alt sayfalar temanın yüzey rengini alır (koyu premium temalarda gri kalmasın)
    dialogTheme: DialogThemeData(
      backgroundColor: surfaceColor,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: surfaceColor,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
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
  const GradientButton({super.key, required this.label, required this.onPressed, this.busy = false, this.icon, this.dense = false, this.coin});
  final String label;
  // Verilirse etiketin yanında jeton simgesiyle fiyat gösterilir
  final int? coin;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;
  final bool dense; // kompakt yükseklik (44)

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    return Semantics(
      button: true,
      enabled: enabled,
      label: coin == null ? label : '$label $coin',
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
        decoration: ShapeDecoration(shape: StadiumBorder(), gradient: Brand.gradient),
        child: Material(
          color: Colors.transparent,
          shape: const StadiumBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: enabled
                ? () {
                    Fx.tap();
                    onPressed!();
                  }
                : null,
            child: SizedBox(
              height: dense ? 44 : 52,
              child: Center(
                child: busy
                    ? const SizedBox.square(
                        dimension: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                      )
                    : Row(mainAxisSize: MainAxisSize.min, children: [
                        if (icon != null) ...[Icon(icon, color: Brand.onAccent, size: 20), const SizedBox(width: 8)],
                        Text(
                          label,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Brand.onAccent),
                        ),
                        if (coin != null) ...[
                          Text(' · ', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Brand.onAccent)),
                          Icon(Icons.toll_rounded, color: Brand.onAccent, size: 20),
                          const SizedBox(width: 3),
                          Text('$coin', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Brand.onAccent, fontWeight: FontWeight.w800)),
                        ],
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
    final text = Text('vibeupme', style: style.copyWith(color: Colors.white));
    if (light) return text;
    return ShaderMask(
      shaderCallback: (r) => Brand.gradient.createShader(r),
      blendMode: BlendMode.srcIn,
      child: text,
    );
  }
}

// Faz 20: uygulama logosu (kalp + kamera) — şeffaf zeminli, yazıdan bağımsız küçük işaret. [height] ile
// yüksekliği verilir, genişlik oranla (498x386) hesaplanır.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.height = 34});
  final double height;

  @override
  Widget build(BuildContext context) =>
      Image.asset('assets/icon/logo.png', height: height, fit: BoxFit.contain, filterQuality: FilterQuality.medium);
}
