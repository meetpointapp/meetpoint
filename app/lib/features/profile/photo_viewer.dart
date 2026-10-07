import 'package:flutter/material.dart';

import '../../core/models.dart';
import '../../core/ui.dart';

// Faz 20: profil fotoğrafları küçük gösterilir, dokununca tam ekranda büyür (kaydırarak gezilir,
// iki parmakla yakınlaştırılır). Hem kendi hem başkasının profilinde kullanılır.
Future<void> showPhotoViewer(BuildContext context, List<Photo> photos, {int initial = 0}) {
  if (photos.isEmpty) return Future.value();
  return Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder<void>(
      opaque: false,
      barrierColor: Colors.black87,
      barrierDismissible: true,
      transitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (_, _, _) => _PhotoViewer(photos: photos, initial: initial.clamp(0, photos.length - 1)),
      transitionsBuilder: (_, anim, _, child) => FadeTransition(opacity: anim, child: child),
    ),
  );
}

class _PhotoViewer extends StatefulWidget {
  const _PhotoViewer({required this.photos, required this.initial});
  final List<Photo> photos;
  final int initial;

  @override
  State<_PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<_PhotoViewer> {
  late final PageController _controller = PageController(initialPage: widget.initial);
  late int _index = widget.initial;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final count = widget.photos.length;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(fit: StackFit.expand, children: [
        PageView.builder(
          controller: _controller,
          itemCount: count,
          onPageChanged: (i) => setState(() => _index = i),
          itemBuilder: (_, i) => GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: InteractiveViewer(
              minScale: 1,
              maxScale: 4,
              child: Center(child: NetPhoto(widget.photos[i].fullUrl, fit: BoxFit.contain)),
            ),
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(children: [
              IconButton.filled(
                style: IconButton.styleFrom(backgroundColor: Colors.black45, foregroundColor: Colors.white),
                icon: const Icon(Icons.close_rounded),
                onPressed: () => Navigator.of(context).pop(),
              ),
              const Spacer(),
              if (count > 1)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: ShapeDecoration(shape: const StadiumBorder(), color: Colors.black45),
                  child: Text('${_index + 1} / $count', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                ),
            ]),
          ),
        ),
      ]),
    );
  }
}
