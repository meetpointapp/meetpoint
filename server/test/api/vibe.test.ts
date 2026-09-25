// Faz 16: "Kendini Keşfet" vibe sistemi. Kural tabanlı (yapay zekâ yok): 10 soru 4 eksende
// puanlanır, sonuç en yakın arketip vektörüne eşlenir. src/vibe.ts saf fonksiyonlarını doğrudan
// kullanarak (oracle) uçtan uca kaydın/rota mantığının doğru çalıştığını doğruluyoruz; ayrıca
// eksen yönü açık seçimlerle (en yüksek/en düşük "macera" deltası) anlamsal bir mantık kontrolü de
// yapıyoruz.
import { describe, it } from 'vitest';
import { compatibilityTier, computeArchetype, VIBE_ARCHETYPES, VIBE_QUESTIONS } from '../../src/vibe';
import { call, check, makeUser } from '../helpers';

function pickExtreme(axis: 'macera' | 'sosyal' | 'spontane' | 'romantik', direction: 'max' | 'min') {
  const answers: Record<string, string> = {};
  for (const q of VIBE_QUESTIONS) {
    let best = q.options[0];
    for (const o of q.options) {
      const bestVal = best.deltas[axis] ?? 0;
      const val = o.deltas[axis] ?? 0;
      if (direction === 'max' ? val > bestVal : val < bestVal) best = o;
    }
    answers[q.id] = best.id;
  }
  return answers;
}

describe('"Kendini Keşfet" vibe sistemi (Faz 16)', () => {
  it('tüm sorular cevaplanmadan veya bilinmeyen seçenekle reddedilir', async () => {
    const a = await makeUser('Vibe1a', 'male', 'female');
    const partial: Record<string, string> = {};
    partial[VIBE_QUESTIONS[0].id] = VIBE_QUESTIONS[0].options[0].id;
    const missing = await call(a.t, 'PUT', '/me/vibe', partial);
    check('eksik cevap reddedilir', missing.http === 400);

    const full = Object.fromEntries(VIBE_QUESTIONS.map((q) => [q.id, q.options[0].id]));
    full[VIBE_QUESTIONS[0].id] = 'not_a_real_option';
    const invalid = await call(a.t, 'PUT', '/me/vibe', full);
    check('geçersiz seçenek reddedilir', invalid.http === 400);
  });

  it('kaydedilen cevaplar saf hesaplama fonksiyonuyla aynı arketipi verir', async () => {
    const a = await makeUser('Vibe2a', 'male', 'female');
    const answers = Object.fromEntries(VIBE_QUESTIONS.map((q) => [q.id, q.options[2].id]));
    const expected = computeArchetype(answers, []);
    const saved = await call(a.t, 'PUT', '/me/vibe', answers);
    check('arketip döner ve katalogda var', VIBE_ARCHETYPES.some((x) => x.id === saved.archetypeId));
    check('kaydedilen arketip saf fonksiyonla eşleşir', saved.archetypeId === expected);

    const fetched = await call(a.t, 'GET', '/me/vibe');
    check('cevaplar geri okunur', Object.keys(answers).every((k) => fetched.answers[k] === answers[k]));
    check('arketip geri okunur', fetched.archetypeId === expected);

    const me = await call(a.t, 'GET', '/me');
    check('GET /me arketipi yansıtır', me.profile.vibeArchetypeId === expected);
  });

  it('en maceracı cevaplar negatif "macera" arketipi vermez, en az maceracı cevaplar pozitif vermez', async () => {
    const a = await makeUser('Vibe3a', 'male', 'female');
    const adventurous = pickExtreme('macera', 'max');
    const savedHigh = await call(a.t, 'PUT', '/me/vibe', adventurous);
    const archHigh = VIBE_ARCHETYPES.find((x) => x.id === savedHigh.archetypeId)!;
    check('en maceracı cevaplar setinde arketipin macera bileşeni negatif değil', archHigh.vector.macera >= 0);

    const calm = pickExtreme('macera', 'min');
    const savedLow = await call(a.t, 'PUT', '/me/vibe', calm);
    const archLow = VIBE_ARCHETYPES.find((x) => x.id === savedLow.archetypeId)!;
    check('en az maceracı cevaplar setinde arketipin macera bileşeni pozitif değil', archLow.vector.macera <= 0);
  });

  it('profil güncellenince (ilgi alanları) arketip yeniden hesaplanır', async () => {
    const a = await makeUser('Vibe4a', 'male', 'female');
    // Tüm eksenlerde en düşük "macera" seçeneklerini işaretle (baz çizgi düşük/negatif macera)
    const calm = pickExtreme('macera', 'min');
    await call(a.t, 'PUT', '/me/vibe', calm);
    const before = await call(a.t, 'GET', '/me/vibe');

    // Güçlü macera dürtmeli 5 ilgi alanı ekle (src/vibe.ts INTEREST_VIBE_NUDGE): +5 macera
    const withInterests = await call(a.t, 'PUT', '/me/profile', {
      displayName: 'Vibe4a', birthDate: '1996-03-10', gender: 'male', interestedIn: 'female',
      interests: ['travel', 'hiking', 'camping', 'running', 'cycling'],
    });
    check('profil kaydedildi', withInterests.http === 200);

    const after = await call(a.t, 'GET', '/me/vibe');
    const expected = computeArchetype(calm, ['travel', 'hiking', 'camping', 'running', 'cycling']);
    check('ilgi alanları eklenince arketip saf fonksiyonla yeniden eşleşir', after.archetypeId === expected);
    // Aşırı düşük macera + güçlü pozitif dürtme genelde arketipi değiştirir (garanti değil ama bu
    // uç senaryoda evet) — asıl garanti, cevapların/ilgi alanlarının doğru şekilde işlendiğidir.
    check('cevaplar korunur (sadece arketip yeniden hesaplanır)', Object.keys(calm).every((k) => after.answers[k] === before.answers[k]));
  });

  it('uyum notu: aynı arketip benzer, yol haritasındaki örnek çift zıt kutuplar çıkar', () => {
    check('aynı arketip her zaman benzer', compatibilityTier('maceraci_romantik', 'maceraci_romantik') === 'similar');
    check(
      'Maceracı Romantik + Sakin Gözlemci: zıt kutuplar (yol haritası örneği)',
      compatibilityTier('maceraci_romantik', 'sakin_gozlemci') === 'opposite',
    );
    check('bilinmeyen kimlikte güvenli varsayılan döner', compatibilityTier('nope', 'maceraci_romantik') === 'similar');
  });

  it('başkası da profildeki vibe arketipini görür', async () => {
    const a = await makeUser('Vibe5a', 'male', 'female');
    const b = await makeUser('Vibe5b', 'female', 'male');
    const answers = Object.fromEntries(VIBE_QUESTIONS.map((q) => [q.id, q.options[1].id]));
    const saved = await call(a.t, 'PUT', '/me/vibe', answers);
    const seenByOther = await call(b.t, 'GET', `/users/${a.id}`);
    check('başkası arketipi görür', seenByOther.vibeArchetypeId === saved.archetypeId);
  });
});
