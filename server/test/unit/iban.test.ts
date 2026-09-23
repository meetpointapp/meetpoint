import { describe, expect, it } from 'vitest';
import { maskAccount, normalizeIban } from '../../src/iban';

describe('normalizeIban', () => {
  it('geçerli TR IBAN: boşluklar atılır, büyük harfe çevrilir', () => {
    expect(normalizeIban('tr33 0006 1005 1978 6457 8413 26')).toBe('TR330006100519786457841326');
  });

  it('geçerli yabancı IBAN (DE, GB) kabul edilir', () => {
    expect(normalizeIban('DE89 3704 0044 0532 0130 00')).toBe('DE89370400440532013000');
    expect(normalizeIban('GB29 NWBK 6016 1331 9268 19')).toBe('GB29NWBK60161331926819');
  });

  it('kontrol hanesi yanlışsa reddedilir', () => {
    expect(normalizeIban('TR33 0006 1005 1978 6457 8413 27')).toBeNull();
    expect(normalizeIban('TR34 0006 1005 1978 6457 8413 26')).toBeNull();
  });

  it('TR IBAN 26 karakter olmalı', () => {
    expect(normalizeIban('TR33 0006 1005 1978 6457 8413 2')).toBeNull();
  });

  it('biçimsiz girdiler reddedilir', () => {
    for (const bad of ['', 'TR', '1234567890123456', 'TR33-0006-1005', 'ÇR330006100519786457841326']) {
      expect(normalizeIban(bad)).toBeNull();
    }
  });
});

describe('maskAccount', () => {
  it('IBAN\'ın sadece son 4 hanesi görünür', () => {
    expect(maskAccount('iban', 'TR330006100519786457841326')).toBe('•••• 1326');
  });

  it('PayPal e-postasının ilk harfi ve alan adı görünür', () => {
    expect(maskAccount('paypal', 'ece.yilmaz@example.com')).toBe('e•••@example.com');
  });
});
