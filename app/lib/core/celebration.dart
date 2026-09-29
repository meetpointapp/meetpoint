import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../l10n/app_localizations.dart';
import 'fx.dart';
import 'models.dart';
import 'providers.dart';
import 'share_card.dart';
import 'share_templates.dart';
import 'theme.dart';
import 'ui.dart';

// Faz 16: eşleşme anı — her akışta (kaydırma, "seni beğenenler", ilgi alanı keşfi) aynı kutlama
// kalitesiyle karşılanır: güçlü haptik + kısa kutlama sesi + iki fotoğrafın uçuşarak birleştiği
// bir kart, sıradan bir bildirim çubuğu değil.
void showMatchCelebration(BuildContext context, WidgetRef ref, {required PublicProfile other, required String conversationId}) {
  Fx.celebrate();
  final me = ref.read(meProvider).value?.profile;
  showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'match',
    barrierColor: Colors.black87,
    transitionDuration: const Duration(milliseconds: 350),
    pageBuilder: (ctx, _, _) => MatchOverlay(
      me: me,
      other: other,
      onChat: () {
        Navigator.pop(ctx);
        context.push('/chat/$conversationId');
      },
    ),
    transitionBuilder: (_, anim, _, child) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(
        scale: Tween(begin: 0.85, end: 1.0).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutBack)),
        child: child,
      ),
    ),
  );
}

// Eşleşme ekranı: iki fotoğraf üst üste, ortada kalp
class MatchOverlay extends StatelessWidget {
  const MatchOverlay({super.key, required this.me, required this.other, required this.onChat});
  final PublicProfile? me;
  final PublicProfile other;
  final VoidCallback onChat;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);

    Widget photo(PublicProfile? p, double angle) => Transform.rotate(
          angle: angle,
          child: Container(
            width: 130,
            height: 170,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 16)],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(15),
              child: NetPhoto(p?.coverThumbUrl, width: 130, height: 170),
            ),
          ),
        );

    return Material(
      type: MaterialType.transparency,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            ShaderMask(
              shaderCallback: (r) => Brand.gradient.createShader(r),
              blendMode: BlendMode.srcIn,
              child: Text(l.itsAMatch,
                  style: theme.textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w900, color: Colors.white)),
            ),
            const SizedBox(height: 28),
            SizedBox(
              height: 190,
              width: 280,
              child: Stack(alignment: Alignment.center, children: [
                Positioned(left: 0, top: 0, bottom: 0, child: Center(child: photo(me, -0.12))),
                Positioned(right: 0, top: 0, bottom: 0, child: Center(child: photo(other, 0.12))),
                Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(shape: BoxShape.circle, gradient: Brand.gradient),
                  child: const Icon(Icons.favorite_rounded, color: Colors.white, size: 28),
                ),
              ]),
            ),
            const SizedBox(height: 24),
            Text(l.matchBody(other.displayName),
                textAlign: TextAlign.center, style: theme.textTheme.bodyLarge?.copyWith(color: Colors.white70)),
            const SizedBox(height: 28),
            GradientButton(label: l.sendMessage, icon: Icons.chat_bubble_rounded, onPressed: onChat),
            const SizedBox(height: 8),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(l.keepSwiping, style: const TextStyle(color: Colors.white70)),
              ),
              TextButton.icon(
                onPressed: () => shareCardImage(context, card: matchShareCard(l, me, other), text: '${l.shareMatchTitle} ${l.shareMatchWith(other.displayName)}'),
                icon: const Icon(Icons.ios_share_rounded, size: 18, color: Colors.white70),
                label: Text(l.shareButton, style: const TextStyle(color: Colors.white70)),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}
