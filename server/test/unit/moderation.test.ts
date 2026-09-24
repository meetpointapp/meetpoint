import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { contactInfo, SKIN_THRESHOLD, skinRatio } from '../../src/moderation/detect';
import { batchHash, rowsHash, type TrafficRow } from '../../src/moderation/traffic';

describe('sohbette iletişim bilgisi', () => {
  it.each([
    ['beni ara 0532 123 45 67', 'phone'],
    ['+90 (532) 123-45-67', 'phone'],
    ['numaram 5321234567', 'phone'],
    ['IBAN: TR33 0006 1005 1978 6457 8413 26', 'iban'],
    ['IBAN TR33 0006 1005 1978 6457 8413 26', 'iban'],
    ['ibanım tr330006100519786457841326', 'iban'],
    ['mail at ayse.k@gmail.com', 'email'],
    ['insta: @ayse.k', 'social'],
    ['whatsapp tan yaz', 'social'],
    ['şuraya bak www.site.com', 'link'],
  ])('%s → %s', (text, kind) => {
    expect(contactInfo(text)).toContain(kind);
  });

  it.each(['Merhaba nasılsın?', 'Saat 20:30 da buluşalım mı', '3 kedim var, 2 köpeğim', '2026 da mezun oldum'])('masum: %s', (text) => {
    expect(contactInfo(text)).toEqual([]);
  });
});

describe('fotoğraf ten oranı', () => {
  const solid = (r: number, g: number, b: number) => sharp({ create: { width: 100, height: 100, channels: 3, background: { r, g, b } } }).png().toBuffer();

  it('ten rengiyle dolu görüntü eşiği geçer, diğerleri geçmez', async () => {
    expect(await skinRatio(await solid(224, 172, 140))).toBeGreaterThanOrEqual(SKIN_THRESHOLD);
    expect(await skinRatio(await solid(40, 120, 200))).toBeLessThan(0.1);
    expect(await skinRatio(await solid(30, 30, 30))).toBeLessThan(0.1);
  });
});

describe('trafik kaydı hash zinciri', () => {
  const row = (ip: string): TrafficRow => ({ userId: 'u1', ip, port: 5000, method: 'POST', path: '/x', status: 201, createdAt: new Date('2026-09-24T10:00:00Z') });

  it('satır değişince özet değişir, zincir bir öncekine bağlı', () => {
    const a = rowsHash([row('1.1.1.1'), row('2.2.2.2')]);
    expect(rowsHash([row('1.1.1.1'), row('2.2.2.3')])).not.toBe(a);
    expect(batchHash('genesis', a)).not.toBe(batchHash('baska', a));
  });
});
