import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';
import 'room_screen.dart';

// Faz 17 madde 10: "Odanı sergile" — haftalık "en güzel odalar" galerisi. Kural tabanlı sıralama
// (yapay zekâ yok): son 7 günde güncellenmiş, sergilemeyi açık bırakmış odalardan en çok eşyalı 10
// tanesi (bkz. server/src/routes/profile.ts GET /rooms/showcase). Emek verilen bir şeyi paylaşma
// isteği doğal bir viral döngü yaratır.
final roomShowcaseProvider = FutureProvider.autoDispose<List<RoomShowcaseEntry>>(
  (ref) => ref.watch(apiProvider).roomShowcase(),
);

class RoomShowcaseScreen extends ConsumerWidget {
  const RoomShowcaseScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final showcase = ref.watch(roomShowcaseProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.roomShowcaseTitle)),
      body: SafeArea(
        child: showcase.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(roomShowcaseProvider)),
          data: (rooms) => rooms.isEmpty
              ? CenteredMessage(icon: Icons.chair_alt_outlined, text: l.roomShowcaseEmpty)
              : GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.62,
                  ),
                  itemCount: rooms.length,
                  itemBuilder: (_, i) {
                    final r = rooms[i];
                    return InkWell(
                      borderRadius: BorderRadius.circular(Brand.radius),
                      onTap: () => context.push('/user/${r.userId}/room'),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        if (i < 3)
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Padding(
                              padding: const EdgeInsets.only(bottom: 4, left: 2),
                              child: Text('🏆 #${i + 1}', style: Theme.of(context).textTheme.labelSmall),
                            ),
                          ),
                        Expanded(child: RoomCanvas(room: RoomInfo(wallpaperId: r.wallpaperId, floorId: r.floorId, items: r.items))),
                        const SizedBox(height: 6),
                        Text(r.displayName, style: Theme.of(context).textTheme.labelMedium, overflow: TextOverflow.ellipsis),
                      ]),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
