import 'package:flutter_test/flutter_test.dart';
import 'package:meetpoint/features/chat/emoji_picker.dart';

void main() {
  group('isEmojiOnly (büyük emoji mesajı)', () {
    test('1-3 emoji büyük gösterilir', () {
      expect(isEmojiOnly('😍'), isTrue);
      expect(isEmojiOnly('😍🔥'), isTrue);
      expect(isEmojiOnly('❤️'), isTrue);
      expect(isEmojiOnly('👩‍❤️‍👨'), isTrue);
      expect(isEmojiOnly('👍🏽'), isTrue);
      expect(isEmojiOnly(' 😂 '), isTrue);
    });
    test('metin veya 3ten fazla emoji büyük gösterilmez', () {
      expect(isEmojiOnly('selam 😍'), isFalse);
      expect(isEmojiOnly('😍😍😍😍'), isFalse);
      expect(isEmojiOnly('123'), isFalse);
      expect(isEmojiOnly(''), isFalse);
    });
  });
}
