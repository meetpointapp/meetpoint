import type { CompanyInfo } from '@prisma/client';
import { prisma } from '../db';

// Künye: şirket (satıcı / hizmet sağlayıcı / veri sorumlusu) bilgileri. Panelden doldurulur; yasal
// metinlerdeki {{alan}} yer tutucuları buradan dolar. Boş alan metinde köşeli parantezle görünür
// ("[Şirket Unvanı]") ki eksik olduğu gözden kaçmasın.

const TTL_MS = Number(process.env.FINANCE_CACHE_MS ?? 5000);
let cache: { at: number; info: CompanyInfo } | null = null;

export async function getCompany() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.info;
  const info = await prisma.companyInfo.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  cache = { at: Date.now(), info };
  return info;
}

export const invalidateCompany = () => {
  cache = null;
};

export const COMPANY_FIELDS = [
  'legalName',
  'mersisNo',
  'taxOffice',
  'taxNo',
  'address',
  'kepAddress',
  'email',
  'kvkkEmail',
  'phone',
  'etbisNo',
  'verbisNo',
] as const;
export type CompanyField = (typeof COMPANY_FIELDS)[number];

export const COMPANY_LABELS: Record<CompanyField, { tr: string; en: string }> = {
  legalName: { tr: 'Şirket Unvanı', en: 'Company Name' },
  mersisNo: { tr: 'MERSİS No', en: 'MERSIS No' },
  taxOffice: { tr: 'Vergi Dairesi', en: 'Tax Office' },
  taxNo: { tr: 'Vergi No', en: 'Tax No' },
  address: { tr: 'Adres', en: 'Address' },
  kepAddress: { tr: 'KEP Adresi', en: 'Registered E-mail (KEP)' },
  email: { tr: 'destek@alanadi.com', en: 'support@domain.com' },
  kvkkEmail: { tr: 'kvkk@alanadi.com', en: 'privacy@domain.com' },
  phone: { tr: 'Telefon', en: 'Phone' },
  etbisNo: { tr: 'ETBİS Kayıt No', en: 'ETBIS Registration No' },
  verbisNo: { tr: '—', en: '—' },
};

// Eksik zorunlu alanlar (yayın öncesi kontrol ve panel uyarısı için)
export const REQUIRED_COMPANY_FIELDS: CompanyField[] = ['legalName', 'mersisNo', 'address', 'kepAddress', 'email', 'kvkkEmail'];

export const missingCompanyFields = (c: CompanyInfo) => REQUIRED_COMPANY_FIELDS.filter((f) => !c[f].trim());

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

// Metindeki {{alan}} yer tutucularını doldur (HTML içinde güvenli)
export function fillCompany(html: string, c: CompanyInfo, lang: 'tr' | 'en') {
  return html.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => {
    if (!(COMPANY_FIELDS as readonly string[]).includes(key)) return whole;
    const value = c[key as CompanyField].trim();
    return value ? esc(value) : `[${COMPANY_LABELS[key as CompanyField][lang]}]`;
  });
}

// Uygulamanın ve web'in gösterdiği künye (sadece dolu alanlar)
export function publicCompany(c: CompanyInfo) {
  return Object.fromEntries(COMPANY_FIELDS.map((f) => [f, c[f]]).filter(([, v]) => v)) as Partial<Record<CompanyField, string>>;
}
