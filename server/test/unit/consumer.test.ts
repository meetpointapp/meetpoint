import { describe, expect, it } from 'vitest';
import type { CompanyInfo } from '@prisma/client';
import { fillCompany, missingCompanyFields } from '../../src/consumer/company';
import { fillValues } from '../../src/support/help';
import { inQuietHours, notifyPrefsState, pushDecision } from '../../src/notify';

const at = (hh: number, mm = 0) => new Date(Date.UTC(2026, 8, 25, hh, mm));
const user = (quietStart: number | null, quietEnd: number | null, notifyPrefs: object = {}, tzOffsetMin = 180) => ({
  notifyPrefs,
  quietStart,
  quietEnd,
  tzOffsetMin,
});

describe('sessiz saatler', () => {
  it('gece yarısını aşan aralık (23:00-08:00, İstanbul = UTC+3)', () => {
    const u = user(23 * 60, 8 * 60);
    expect(inQuietHours(u, at(20, 0))).toBe(true); // 23:00 yerel
    expect(inQuietHours(u, at(1, 30))).toBe(true); // 04:30 yerel
    expect(inQuietHours(u, at(4, 59))).toBe(true); // 07:59 yerel
    expect(inQuietHours(u, at(5, 0))).toBe(false); // 08:00 yerel: bitti
    expect(inQuietHours(u, at(12, 0))).toBe(false);
  });

  it('gün içi aralık ve farklı saat dilimi', () => {
    const u = user(13 * 60, 14 * 60, {}, 0);
    expect(inQuietHours(u, at(13, 30))).toBe(true);
    expect(inQuietHours(u, at(14, 0))).toBe(false);
  });

  it('kapalı veya başlangıç = bitiş ise sessiz saat yok', () => {
    expect(inQuietHours(user(null, null), at(1))).toBe(false);
    expect(inQuietHours(user(600, 600), at(7))).toBe(false);
  });

  it('aramalar sessiz saatten muaf ama kapatılabilir; ödeme/destek kapatılamaz', () => {
    const quiet = user(0, 1439);
    expect(pushDecision(quiet, 'call', at(10))).toBe('ok');
    expect(pushDecision(quiet, 'message', at(10))).toBe('quiet');
    expect(pushDecision(user(null, null, { call: false }), 'call')).toBe('disabled');
    expect(pushDecision(user(null, null, { like: false }), 'superlike')).toBe('disabled');
    expect(pushDecision(user(null, null, { message: false, match: false, request: false, call: false, like: false }), 'support')).toBe('ok');
    expect(pushDecision(user(null, null, { message: false }), 'payout')).toBe('ok');
  });

  it('tercih durumu: varsayılan hepsi açık, sessiz saat önerisi 23:00-08:00', () => {
    const s = notifyPrefsState(user(null, null, { match: false }));
    expect(s.prefs).toEqual({ message: true, match: false, request: true, call: true, like: true });
    expect(s.quietHours).toEqual({ enabled: false, start: 1380, end: 480 });
  });
});

describe('künye ve metin değerleri', () => {
  const empty = { id: 1, legalName: '', mersisNo: '', taxOffice: '', taxNo: '', address: '', kepAddress: '', email: '', kvkkEmail: '', phone: '', etbisNo: '', verbisNo: '', updatedBy: '', updatedAt: new Date() } as CompanyInfo;

  it('boş alan köşeli parantezle, dolu alan HTML kaçışlı', () => {
    expect(fillCompany('{{legalName}} · {{address}}', empty, 'tr')).toBe('[Şirket Unvanı] · [Adres]');
    expect(fillCompany('{{legalName}}', empty, 'en')).toBe('[Company Name]');
    expect(fillCompany('{{legalName}}', { ...empty, legalName: 'A & B <Ltd>' }, 'tr')).toBe('A &amp; B &lt;Ltd&gt;');
    expect(fillCompany('{{bilinmeyen}}', empty, 'tr')).toBe('{{bilinmeyen}}');
  });

  it('yayın öncesi eksik zorunlu alanlar', () => {
    expect(missingCompanyFields(empty)).toContain('mersisNo');
    expect(missingCompanyFields({ ...empty, legalName: 'X', mersisNo: '1', address: 'a', kepAddress: 'k', email: 'e', kvkkEmail: 'v' })).toEqual([]);
  });

  it('SSS değerleri ayarlardan dolar', () => {
    expect(fillValues('{{voiceRate}} jeton, {{x}}', { voiceRate: 15 })).toBe('15 jeton, {{x}}');
  });
});
