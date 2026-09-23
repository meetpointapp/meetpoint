// Yaş hesapları. Doğum tarihleri UTC gece yarısı olarak saklanır; hesaplar da UTC ile yapılır ki
// sunucunun saat dilimi sonucu değiştirmesin (ör. 18 yaş sınırı bir gün erken açılmasın).

export function ageOf(birthDate: Date, now = new Date()) {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

// Bugün `years` yaşını dolduran birinin doğum günü (UTC gece yarısı).
// Yaşı en az N olanlar: birthDate <= birthdayForAge(N)
// Yaşı en fazla N olanlar: birthDate >  birthdayForAge(N + 1)
export function birthdayForAge(years: number, now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()));
}
