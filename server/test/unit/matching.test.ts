import { describe, expect, it } from 'vitest';
import { astroCompat, interestsCompat, matchReason, musicCompat, vibeCompat, zodiacFromDate, zodiacOf } from '../../src/matching';

describe('burç hesabı', () => {
  it.each([
    ['1990-01-19', 'capricorn'],
    ['1990-01-20', 'aquarius'],
    ['1990-03-20', 'pisces'],
    ['1990-03-21', 'aries'],
    ['1990-10-23', 'scorpio'],
    ['1990-10-22', 'libra'],
    ['1990-12-21', 'sagittarius'],
    ['1990-12-22', 'capricorn'],
    ['1998-06-15', 'gemini'],
  ])('%s → %s', (date, sign) => {
    expect(zodiacFromDate(new Date(date))).toBe(sign);
  });

  it('seçilmiş burç doğum tarihinden önce gelir, boşsa tarihten hesaplanır', () => {
    expect(zodiacOf({ birthDate: new Date('1990-10-23'), zodiac: 'leo' })).toBe('leo');
    expect(zodiacOf({ birthDate: new Date('1990-10-23'), zodiac: '' })).toBe('scorpio');
  });
});

describe('burç uyumu', () => {
  it('aynı elementin burçları (üçgen) en yüksek skoru alır', () => {
    expect(astroCompat('scorpio', 'cancer')).toMatchObject({ key: 'astro_trine', score: 95 });
    expect(astroCompat('aries', 'leo')).toMatchObject({ key: 'astro_trine' });
  });

  it('Akrep–Aslan kare açıdır: kıvılcım çıkaran çekim olarak önerilir', () => {
    expect(astroCompat('scorpio', 'leo')).toMatchObject({ key: 'astro_square', args: ['scorpio', 'leo'] });
  });

  it('karşıt burçlar birbirini çeker', () => {
    expect(astroCompat('aries', 'libra')).toMatchObject({ key: 'astro_opposite' });
  });

  it('komşu ve garip açılı burçlar önerilmez', () => {
    expect(astroCompat('aries', 'taurus')).toBeNull();
    expect(astroCompat('aries', 'virgo')).toBeNull();
  });

  it('sıra fark etmez', () => {
    expect(astroCompat('leo', 'scorpio')?.score).toBe(astroCompat('scorpio', 'leo')?.score);
  });
});

describe('müzik, ilgi ve vibe uyumu', () => {
  it('ortak müzik türü sayısı skoru yükseltir', () => {
    expect(musicCompat({ musicGenres: ['rock', 'jazz'] }, { musicGenres: ['rock'] })).toMatchObject({ score: 70, args: ['rock'] });
    expect(musicCompat({ musicGenres: ['rock', 'jazz'] }, { musicGenres: ['jazz', 'rock'] })?.score).toBe(90);
    expect(musicCompat({ musicGenres: ['rock'] }, { musicGenres: ['pop'] })).toBeNull();
    expect(musicCompat({ musicGenres: [] }, { musicGenres: ['pop'] })).toBeNull();
  });

  it('ortak ilgi alanı yoksa öneri çıkmaz', () => {
    expect(interestsCompat({ interests: ['coffee', 'travel'] }, { interests: ['travel', 'books'] })).toMatchObject({ args: ['travel'] });
    expect(interestsCompat({ interests: ['coffee'] }, { interests: ['books'] })).toBeNull();
  });

  it('vibe: benzer ve tamamlayıcı önerilir, zıt kutuplar önerilmez, test çözülmemişse çıkmaz', () => {
    expect(vibeCompat({ vibeArchetypeId: 'ozgur_ruh' }, { vibeArchetypeId: 'ozgur_ruh' })).toMatchObject({ key: 'vibe_similar' });
    expect(vibeCompat({ vibeArchetypeId: 'ozgur_ruh' }, { vibeArchetypeId: 'sakin_gozlemci' })).toBeNull();
    expect(vibeCompat({ vibeArchetypeId: '' }, { vibeArchetypeId: 'ozgur_ruh' })).toBeNull();
  });

  it('matchReason moda göre doğru hesabı seçer', () => {
    const a = { birthDate: new Date('1990-10-25'), zodiac: '', interests: [], musicGenres: ['pop'], vibeArchetypeId: '' };
    const b = { birthDate: new Date('1990-08-01'), zodiac: '', interests: [], musicGenres: ['pop'], vibeArchetypeId: '' };
    expect(matchReason('astro', a, b)).toMatchObject({ key: 'astro_square', args: ['scorpio', 'leo'] });
    expect(matchReason('music', a, b)).toMatchObject({ key: 'music_shared' });
    expect(matchReason('interests', a, b)).toBeNull();
  });
});
