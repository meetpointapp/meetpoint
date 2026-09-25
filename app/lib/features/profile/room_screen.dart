import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/catalog.dart';
import '../../core/models.dart';
import '../../core/providers.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import '../../l10n/app_localizations.dart';

// Faz 16: kendi oda. Statik yerleşim (gerçek zamanlı gezinme yok): duvar kağıdı + zemin rengi +
// sabit bir ızgaraya yerleştirilmiş eşyalar. Eşleştiğin/bağlantılı olduğun kişi salt görüntüleme
// ile ziyaret edebilir (server: /users/:id/room, bağlantı yoksa 403 not_connected).

class _RoomCanvas extends StatelessWidget {
  const _RoomCanvas({required this.room, this.selected, this.onCellTap});
  final RoomInfo room;
  final String? selected; // düzenlemede: yerleştirilecek eşya; null = salt görüntüleme
  final void Function(int x, int y)? onCellTap;

  @override
  Widget build(BuildContext context) {
    final byPos = {for (final it in room.items) '${it.x},${it.y}': it.itemId};
    return AspectRatio(
      aspectRatio: roomGridW / roomGridH,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Brand.radius),
        child: Stack(fit: StackFit.expand, children: [
          Column(children: [
            Expanded(flex: 4, child: ColoredBox(color: roomWallpaperColorOf(room.wallpaperId))),
            Expanded(flex: 1, child: ColoredBox(color: roomFloorColorOf(room.floorId))),
          ]),
          GridView.builder(
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: roomGridW),
            itemCount: roomGridW * roomGridH,
            itemBuilder: (_, i) {
              final x = i % roomGridW;
              final y = i ~/ roomGridW;
              final itemId = byPos['$x,$y'];
              return GestureDetector(
                onTap: onCellTap == null ? null : () => onCellTap!(x, y),
                child: DecoratedBox(
                  decoration: BoxDecoration(border: Border.all(color: Colors.black.withValues(alpha: 0.06))),
                  child: itemId == null ? null : Center(child: Text(roomItemEmojiOf(itemId), style: const TextStyle(fontSize: 26))),
                ),
              );
            },
          ),
        ]),
      ),
    );
  }
}

class RoomEditorScreen extends ConsumerStatefulWidget {
  const RoomEditorScreen({super.key});

  @override
  ConsumerState<RoomEditorScreen> createState() => _RoomEditorScreenState();
}

class _RoomEditorScreenState extends ConsumerState<RoomEditorScreen> {
  RoomInfo? _room;
  String? _selectedItem;
  bool _saving = false;
  bool _dirty = false;

  // Faz 16: kozmetik mağaza — satın alınmış premium mobilyalar ücretsiz kataloğa eklenir
  Set<String> get _ownedItemIds =>
      ref.watch(storeItemsProvider).value?.where((i) => i.owned).map((i) => i.id).toSet() ?? const <String>{};

  @override
  void initState() {
    super.initState();
    ref.read(apiProvider).myRoom().then((r) {
      if (mounted) setState(() => _room = r);
    });
  }

  void _tapCell(int x, int y) {
    final room = _room!;
    final existing = room.items.where((i) => i.x == x && i.y == y).firstOrNull;
    setState(() {
      if (existing != null) {
        _room = room.copyWith(items: [for (final i in room.items) if (i != existing) i]);
      } else if (_selectedItem != null) {
        if (room.items.length >= roomMaxItems) {
          showSnack(context, AppLocalizations.of(context).roomFull);
          return;
        }
        _room = room.copyWith(items: [...room.items, RoomItem(itemId: _selectedItem!, x: x, y: y)]);
      } else {
        return;
      }
      _dirty = true;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(apiProvider).saveRoom(_room!);
      if (mounted) {
        setState(() => _dirty = false);
        showSnack(context, AppLocalizations.of(context).saved);
      }
    } catch (e) {
      if (mounted) showSnack(context, errorText(AppLocalizations.of(context), e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final room = _room;
    return Scaffold(
      appBar: AppBar(title: Text(l.roomEditTitle), actions: [
        if (_dirty)
          TextButton(onPressed: _saving ? null : _save, child: _saving ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : Text(l.save)),
      ]),
      body: room == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(16), children: [
              _RoomCanvas(room: room, selected: _selectedItem, onCellTap: _tapCell),
              const SizedBox(height: 16),
              Text(l.roomItemsHint, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              const SizedBox(height: 10),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final id in [...roomItemIds, ...storeRoomItemIds.where(_ownedItemIds.contains)])
                  ChoiceChip(
                    label: Text('${roomItemEmojiOf(id)} ${l.roomItemLabel(id)}'),
                    selected: _selectedItem == id,
                    onSelected: (on) => setState(() => _selectedItem = on ? id : null),
                  ),
              ]),
              const SizedBox(height: 24),
              Text(l.roomWallpaper, style: theme.textTheme.titleSmall),
              const SizedBox(height: 10),
              swatchPickerColors(roomWallpaperIds, room.wallpaperId, roomWallpaperColorOf, (id) {
                setState(() {
                  _room = room.copyWith(wallpaperId: id == room.wallpaperId ? '' : id);
                  _dirty = true;
                });
              }),
              const SizedBox(height: 24),
              Text(l.roomFloor, style: theme.textTheme.titleSmall),
              const SizedBox(height: 10),
              swatchPickerColors(roomFloorIds, room.floorId, roomFloorColorOf, (id) {
                setState(() {
                  _room = room.copyWith(floorId: id == room.floorId ? '' : id);
                  _dirty = true;
                });
              }),
            ]),
    );
  }
}

Widget swatchPickerColors(List<String> ids, String selected, Color Function(String) colorFor, ValueChanged<String> onSelect) {
  return Wrap(spacing: 10, runSpacing: 10, children: [
    for (final id in ids)
      GestureDetector(
        onTap: () => onSelect(id),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: colorFor(id),
            border: Border.all(color: id == selected ? Colors.black87 : Colors.black12, width: id == selected ? 2.5 : 1),
          ),
        ),
      ),
  ]);
}

// Ziyaret: salt görüntüleme. Bağlantın yoksa sunucu 403 not_connected döner.
class RoomVisitScreen extends ConsumerWidget {
  const RoomVisitScreen({super.key, required this.userId});
  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final room = ref.watch(userRoomProvider(userId));
    return Scaffold(
      appBar: AppBar(title: Text(room.value?.displayName.isNotEmpty == true ? l.roomVisitTitle(room.value!.displayName) : l.roomSection)),
      body: room.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(userRoomProvider(userId))),
        data: (r) => Padding(padding: const EdgeInsets.all(16), child: _RoomCanvas(room: r)),
      ),
    );
  }
}
