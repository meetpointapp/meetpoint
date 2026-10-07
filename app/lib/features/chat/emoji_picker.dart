import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/theme.dart';
import '../../l10n/app_localizations.dart';

// Faz 20: sohbette emoji gönderme. Dış paket yok — kendi küçük seçicimiz: kategori sekmeleri, ızgara,
// "son kullanılanlar" (cihazda saklanır) ve silme tuşu. Sadece emoji'den oluşan kısa mesajlar
// sohbette büyük gösterilir (bkz. isEmojiOnly).

const _categories = <(String, String, List<String>)>[
  ('😀', 'smileys', [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
    '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐',
    '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😔', '😪', '😴', '😷', '🤒', '🥵', '🥶', '🥴',
    '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😢',
    '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '🤬', '😈', '👿', '💀', '🤡',
  ]),
  ('❤️', 'hearts', [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓',
    '💗', '💖', '💘', '💝', '💟', '♥️', '😍', '🥰', '😘', '😻', '💋', '💌', '💍', '🌹', '🥀', '💐',
    '🌷', '🌸', '🍫', '🍷', '🥂', '🕯️', '✨', '💫', '⭐', '🌟', '💑', '👩‍❤️‍👨', '🫶', '🫰', '💏', '🔥',
  ]),
  ('👋', 'gestures', [
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
    '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🫡',
    '🙈', '🙉', '🙊', '💃', '🕺', '🤷', '🤷‍♀️', '🤷‍♂️', '🤦', '🤦‍♀️', '🤦‍♂️', '🙋', '🙆', '🙅', '💁', '🧏',
  ]),
  ('🎉', 'fun', [
    '🎉', '🎊', '🎁', '🎈', '🎂', '🍰', '🥳', '🎵', '🎶', '🎤', '🎧', '🎸', '🎹', '🥁', '🎬', '🎮',
    '🎯', '🎲', '🧩', '📸', '📷', '🎥', '📚', '✈️', '🌍', '🏖️', '🏝️', '⛰️', '🏕️', '🚗', '🚲', '🛵',
    '⚽', '🏀', '🎾', '🏐', '🏊', '🧘', '🏃', '💃', '🕺', '🍕', '🍔', '🍟', '🌮', '🍣', '🍜', '🍦',
    '🍩', '🍪', '☕', '🍵', '🍺', '🍻', '🍸', '🍹', '🥤', '🍓', '🍑', '🍒', '🍉', '🥑', '🌶️', '🧀',
  ]),
  ('🐶', 'nature', [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈',
    '🐔', '🐧', '🐦', '🦅', '🦉', '🦋', '🐝', '🐞', '🐢', '🐍', '🐙', '🦈', '🐬', '🐳', '🦄', '🐾',
    '🌞', '🌝', '🌛', '🌙', '⭐', '🌈', '☀️', '⛅', '☁️', '🌧️', '⛈️', '❄️', '☃️', '🔥', '💧', '🌊',
    '🌴', '🌵', '🌲', '🍀', '🌿', '🍃', '🍂', '🍁', '🌻', '🌼', '🌺', '🪴', '🌱', '🏔️', '🌅', '🌃',
  ]),
];

const _recentKey = 'recent_emojis';
const _recentMax = 16;

// Mesaj sadece 1-3 emoji'den oluşuyorsa true (sohbette büyük gösterilir)
bool _isEmojiRune(int r) =>
    (r >= 0x1F300 && r <= 0x1FAFF) || // piktogramlar, yüzler, el hareketleri, nesneler
    (r >= 0x1F1E6 && r <= 0x1F1FF) || // bayraklar
    (r >= 0x2600 && r <= 0x27BF) || // çeşitli semboller (☀ ❤ ✨ ✌ ...)
    (r >= 0x2B00 && r <= 0x2BFF) || // ⭐ ⬛ ...
    (r >= 0x2190 && r <= 0x21FF) ||
    (r >= 0x2300 && r <= 0x23FF) ||
    r == 0x200D || // birleştirici (👩‍❤️‍👨)
    r == 0xFE0F || // emoji görünümü
    r == 0x203C ||
    r == 0x2049 ||
    r == 0x00A9 ||
    r == 0x00AE ||
    r == 0x2122;

bool isEmojiOnly(String text) {
  final t = text.trim();
  if (t.isEmpty || t.characters.length > 3) return false;
  return t.runes.every(_isEmojiRune);
}

class EmojiPicker extends StatefulWidget {
  const EmojiPicker({super.key, required this.onEmoji, required this.onBackspace});
  final ValueChanged<String> onEmoji;
  final VoidCallback onBackspace;

  @override
  State<EmojiPicker> createState() => _EmojiPickerState();
}

class _EmojiPickerState extends State<EmojiPicker> {
  String _tabKey = 'smileys'; // 'recent' veya kategori kimliği (son kullanılanlar sonradan eklense de seçim kaymaz)
  List<String> _recent = [];

  @override
  void initState() {
    super.initState();
    _loadRecent();
  }

  Future<void> _loadRecent() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_recentKey) ?? const [];
      if (mounted) setState(() => _recent = list);
    } catch (_) {}
  }

  Future<void> _pick(String emoji) async {
    widget.onEmoji(emoji);
    final next = [emoji, ..._recent.where((e) => e != emoji)].take(_recentMax).toList();
    setState(() => _recent = next);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_recentKey, next);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final hasRecent = _recent.isNotEmpty;
    // Sekmeler: [son kullanılanlar] + kategoriler
    final tabs = <(String, String, List<String>)>[
      if (hasRecent) ('recent', '🕘', _recent),
      for (final c in _categories) (c.$2, c.$1, c.$3),
    ];
    final index = tabs.indexWhere((t) => t.$1 == _tabKey).clamp(0, tabs.length - 1);
    final items = tabs[index].$3;

    return Container(
      height: 264,
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        border: Border(top: BorderSide(color: theme.colorScheme.outlineVariant.withValues(alpha: 0.5))),
      ),
      child: Column(children: [
        SizedBox(
          height: 44,
          child: Row(children: [
            Expanded(
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                itemCount: tabs.length,
                itemBuilder: (_, i) {
                  final on = i == index;
                  return Semantics(
                    button: true,
                    selected: on,
                    label: l.emojiCategoryLabel(tabs[i].$1),
                    excludeSemantics: true,
                    child: GestureDetector(
                      onTap: () => setState(() => _tabKey = tabs[i].$1),
                      child: Container(
                        width: 44,
                        margin: const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: on ? Brand.coral.withValues(alpha: 0.16) : null,
                        ),
                        child: Text(tabs[i].$2, style: const TextStyle(fontSize: 20)),
                      ),
                    ),
                  );
                },
              ),
            ),
            IconButton(
              tooltip: l.emojiBackspace,
              onPressed: widget.onBackspace,
              icon: const Icon(Icons.backspace_outlined),
            ),
          ]),
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 8),
            itemCount: items.length,
            itemBuilder: (_, i) => Semantics(
              button: true,
              label: items[i],
              excludeSemantics: true,
              onTap: () => _pick(items[i]),
              child: InkResponse(
                radius: 22,
                onTap: () => _pick(items[i]),
                child: Center(child: Text(items[i], style: const TextStyle(fontSize: 26))),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}
