import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { decryptField, encryptField, isEncrypted } from '../../src/fieldCrypto';
import { assertPasswordAllowed, hashPassword, verifyPassword } from '../../src/passwords';
import { maskIp } from '../../src/sessions';

describe('alan şifreleme (IBAN, 2FA anahtarı)', () => {
  it('şifreler ve geri çözer; aynı değer her seferinde farklı görünür', () => {
    const iban = 'TR330006100519786457841326';
    const a = encryptField(iban);
    const b = encryptField(iban);
    expect(a).not.toContain(iban);
    expect(a).not.toBe(b);
    expect(isEncrypted(a)).toBe(true);
    expect(decryptField(a)).toBe(iban);
    expect(decryptField(b)).toBe(iban);
  });

  it('şifrelenmemiş eski kayıtlar olduğu gibi okunur, boş değer boş kalır', () => {
    expect(decryptField('TR330006100519786457841326')).toBe('TR330006100519786457841326');
    expect(encryptField('')).toBe('');
    expect(decryptField('')).toBe('');
  });

  it('değiştirilmiş veri reddedilir (bütünlük etiketi)', () => {
    const enc = encryptField('gizli@paypal.com');
    const [v, iv, tag, data] = enc.split(':');
    const flipped = data.slice(0, -2) + (data.at(-2) === 'A' ? 'B' : 'A') + data.at(-1);
    expect(() => decryptField([v, iv, tag, flipped].join(':'))).toThrow();
  });
});

describe('şifreler', () => {
  it('Argon2id ile saklanır ve doğrulanır', async () => {
    const hash = await hashPassword('Meet-Point-Test-2026!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect((await verifyPassword(hash, 'Meet-Point-Test-2026!')).ok).toBe(true);
    expect((await verifyPassword(hash, 'yanlis')).ok).toBe(false);
  });

  it('eski bcrypt özeti girişte Argon2id\'ye yükseltilir', async () => {
    const old = await bcrypt.hash('password123', 4);
    const r = await verifyPassword(old, 'password123');
    expect(r.ok).toBe(true);
    expect(r.upgraded?.startsWith('$argon2id$')).toBe(true);
    expect((await verifyPassword(r.upgraded!, 'password123')).ok).toBe(true);
  });

  it('hesap yoksa da doğrulama yapılır (süre farkından hesap varlığı anlaşılmasın)', async () => {
    expect((await verifyPassword(null, 'herhangi')).ok).toBe(false);
  });

  it('yaygın ve e-postayı içeren şifreler reddedilir', async () => {
    await expect(assertPasswordAllowed('Galatasaray')).rejects.toMatchObject({ code: 'password_too_common' });
    await expect(assertPasswordAllowed('Ahmet.Yilmaz99', 'ahmet.yilmaz@gmail.com')).rejects.toMatchObject({ code: 'password_too_common' });
  });
});

describe('IP gizleme (Cihazlarım, e-posta)', () => {
  it('son bölüm gizlenir', () => {
    expect(maskIp('85.105.12.34')).toBe('85.105.12.*');
    expect(maskIp('::ffff:85.105.12.34')).toBe('85.105.12.*');
    expect(maskIp('2a02:e0:1234:5678::1')).toBe('2a02:e0:1234:…');
  });
});
