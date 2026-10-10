import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'theme.dart';

// Faz 17 madde 9: paylaşılabilir anlar. Dış servis yok — sadece cihazın kendi paylaşım sayfası
// (share_plus, işletim sistemi düzeyinde bir arayüz; hiçbir şey bir VibeUpMe sunucusuna veya
// üçüncü bir servise gönderilmez). Verilen kart widget'ı ekran dışında (Overlay, sol tarafta
// -10000px) render edilir, boyanması beklenir, PNG'ye dönüştürülüp paylaşım sayfası açılır.
Future<void> shareCardImage(BuildContext context, {required Widget card, String? text}) async {
  final key = GlobalKey();
  final overlay = Overlay.of(context, rootOverlay: true);
  final entry = OverlayEntry(
    builder: (_) => Positioned(
      left: -10000,
      top: 0,
      child: Material(
        type: MaterialType.transparency,
        child: RepaintBoundary(key: key, child: card),
      ),
    ),
  );
  overlay.insert(entry);
  try {
    // İki kare bekle: ilki yerleşim + ilk boyama, ikincisi ağdan gelen fotoğrafların boyanmasına pay tanır
    await WidgetsBinding.instance.endOfFrame;
    await WidgetsBinding.instance.endOfFrame;
    final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 2.5);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/vibeupme-share-${DateTime.now().millisecondsSinceEpoch}.png');
    await file.writeAsBytes(bytes!.buffer.asUint8List());
    await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], text: text));
  } finally {
    entry.remove();
  }
}

// Üç paylaşılabilir an (eşleşme, profil, vibe) için ortak marka şablonu: gradyan zemin, ortada
// içerik, altta VibeUpMe logosu. "Kendi şablonumuz" — dış bir tasarım servisi kullanılmaz.
class ShareTemplate extends StatelessWidget {
  const ShareTemplate({super.key, required this.hero, required this.title, this.subtitle});
  final Widget hero;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 480,
      height: 720,
      decoration: const BoxDecoration(gradient: Brand.gradient),
      child: Padding(
        padding: const EdgeInsets.all(36),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Expanded(child: Center(child: hero)),
          const SizedBox(height: 28),
          Text(
            title,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(fontSize: 30, fontWeight: FontWeight.w900, color: Colors.white, height: 1.2),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 10),
            Text(subtitle!, textAlign: TextAlign.center, style: GoogleFonts.inter(fontSize: 17, color: Colors.white70)),
          ],
          const SizedBox(height: 32),
          const BrandLogo(size: 22, light: true),
        ]),
      ),
    );
  }
}
