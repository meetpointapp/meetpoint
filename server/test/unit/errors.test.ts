import { describe, expect, it } from 'vitest';
import { fingerprintOf } from '../../src/errors';

const frame = (line: number, col = 12) =>
  `#0 _ChatScreenState._send (package:meetpoint/features/chat/chat_screen.dart:${line}:${col})\n#1 handleTap`;

describe('hata parmak izi (gruplama)', () => {
  it('satır/sütun numarası farklı olsa da aynı hata aynı grupta', () => {
    const a = fingerprintOf({ source: 'app', message: 'Null check', stack: frame(212) });
    const b = fingerprintOf({ source: 'app', message: 'Null check', stack: frame(230, 3) });
    expect(a).toBe(b);
  });

  it('mesajdaki kayıt kimlikleri ve bellek adresleri gruplamayı bozmaz', () => {
    const a = fingerprintOf({ source: 'server', message: 'Call cmue1nknj002burkc6437d8nz not found at 0x7ffd1a', stack: '' });
    const b = fingerprintOf({ source: 'server', message: 'Call cmuf9zzzz999burkc6437abcd1 not found at 0x10ab2c', stack: '' });
    expect(a).toBe(b);
  });

  it('farklı mesaj veya kaynak farklı grup', () => {
    const base = fingerprintOf({ source: 'app', message: 'Null check', stack: frame(1) });
    expect(fingerprintOf({ source: 'app', message: 'RangeError', stack: frame(1) })).not.toBe(base);
    expect(fingerprintOf({ source: 'server', message: 'Null check', stack: frame(1) })).not.toBe(base);
  });

  it('platform ve sürüm gruplamayı etkilemez (aynı hata tüm cihazlarda tek satır)', () => {
    const a = fingerprintOf({ source: 'app', message: 'X', stack: frame(1), platform: 'android', appVersion: '1.0.0' });
    const b = fingerprintOf({ source: 'app', message: 'X', stack: frame(1), platform: 'ios', appVersion: '1.0.1' });
    expect(a).toBe(b);
  });
});
