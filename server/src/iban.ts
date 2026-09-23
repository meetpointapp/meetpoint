// Para çekme hesap bilgisi kuralları (saf fonksiyonlar, veritabanı gerektirmez)

// IBAN: ülke kodu + 2 kontrol hanesi + hesap; mod-97 kontrolü (ISO 13616). Geçersizse null.
export function normalizeIban(raw: string): string | null {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return null;
  if (iban.startsWith('TR') && iban.length !== 26) return null;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  return rem === 1 ? iban : null;
}

// Kullanıcıya hesabın sadece bir kısmı gösterilir: IBAN'ın son 4 hanesi, PayPal'ın ilk harfi ve alan adı
export function maskAccount(method: string, value: string) {
  return method === 'iban' ? `•••• ${value.slice(-4)}` : value.replace(/^(.).*(@.*)$/, '$1•••$2');
}
