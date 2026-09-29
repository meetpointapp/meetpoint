// Faz 17: günlük giriş serisi (streak). GET /me her çağrıldığında (uygulama her açılışta bunu
// çeker) kullanıcının yerel gününe göre güncellenir — testte "dün"/"önceki gün" durumlarını
// doğrudan veritabanında lastStreakDate'i geriye alarak simüle ediyoruz (mood.test.ts'teki
// moodSetAt kalıbıyla aynı yaklaşım).
import { describe, it } from 'vitest';
import { call, check, makeUser, testDb } from '../helpers';
import { localDateStr } from '../../src/streak';

// sendStreakReminders sunucu sürecinde (ayrı process, test veritabanına bağlı) çalışır; bu yüzden
// buradan doğrudan import edip çağırmak yerine (yanlış veritabanına bağlanır — src/db.ts'nin
// prisma singleton'ı test sürecinin DATABASE_URL'ini görmez), dev-only bir uçtan tetikleriz.
const runStreakReminders = (token: string, now?: Date) => call(token, 'POST', '/dev/streak-reminders', now ? { now: now.toISOString() } : {});

describe('Günlük giriş serisi (Faz 17)', () => {
  it('ilk açılışta seri 1 olur, aynı gün tekrar çağrılırsa artmaz', async () => {
    const a = await makeUser('Streak1', 'male', 'female');

    const me1 = await call(a.t, 'GET', '/me');
    check('ilk açılış: seri 1', me1.streak.current === 1);
    check('ilk açılış: en uzun seri 1', me1.streak.longest === 1);

    const me2 = await call(a.t, 'GET', '/me');
    check('aynı gün ikinci çağrı: seri hâlâ 1', me2.streak.current === 1);
  });

  it('ardışık gün seriyi 1 artırır, en uzun seri güncellenir', async () => {
    const a = await makeUser('Streak2', 'male', 'female');
    await call(a.t, 'GET', '/me'); // 1. gün: seri 1

    const db = await testDb();
    const user = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    const yesterday = localDateStr(new Date(Date.now() - 86_400_000), user.tzOffsetMin);
    await db.user.update({ where: { id: a.id }, data: { lastStreakDate: yesterday } });

    const me = await call(a.t, 'GET', '/me');
    check('ardışık gün: seri 2 oldu', me.streak.current === 2);
    check('ardışık gün: en uzun seri 2 oldu', me.streak.longest === 2);
  });

  it('bir gün atlanırsa seri 1e sıfırlanır ama en uzun seri korunur', async () => {
    const a = await makeUser('Streak3', 'male', 'female');
    const db = await testDb();
    // Önceden 5 günlük bir seri varmış gibi kur, ama son açılış 3 gün önceymiş (atlanmış)
    await db.user.update({
      where: { id: a.id },
      data: { currentStreak: 5, longestStreak: 5, lastStreakDate: localDateStr(new Date(Date.now() - 3 * 86_400_000), 180) },
    });

    const me = await call(a.t, 'GET', '/me');
    check('atlanan gün: seri 1e sıfırlandı', me.streak.current === 1);
    check('atlanan gün: en uzun seri korundu (5)', me.streak.longest === 5);
  });

  it('sendStreakReminders: sadece bugün açmamış, aktif serisi olan ve yerel saati 20:00 geçmiş kullanıcılara, günde bir kez gönderir', async () => {
    const a = await makeUser('Streak4', 'male', 'female'); // bugün açtı (lastStreakDate = bugün) → hatırlatma YOK
    const b = await makeUser('Streak5', 'male', 'female'); // dün açtı, henüz bugün açmadı → hatırlatma VAR
    const c = await makeUser('Streak6', 'male', 'female'); // hiç serisi yok (currentStreak 0) → hatırlatma YOK
    await call(a.t, 'GET', '/me');

    const db = await testDb();
    const tz = 180; // UTC+3 (varsayılan)
    // "Bugün"ü testin gerçekten çalıştığı takvim gününe göre kur (sabit bir tarih yazarsak, GET
    // /me'nin gerçek saatle kaydettiği A'nın lastStreakDate'iyle uyuşmayabilir). Yerel saat 21:00.
    const aAfter = await db.user.findUniqueOrThrow({ where: { id: a.id } });
    const now = new Date(`${aAfter.lastStreakDate}T18:00:00.000Z`);
    const yesterday = localDateStr(new Date(now.getTime() - 86_400_000), tz);
    await db.user.update({ where: { id: b.id }, data: { tzOffsetMin: tz, currentStreak: 3, longestStreak: 3, lastStreakDate: yesterday, streakReminderDate: null } });
    await db.user.update({ where: { id: c.id }, data: { tzOffsetMin: tz, currentStreak: 0, lastStreakDate: null } });

    await runStreakReminders(a.t, now);

    const today = localDateStr(now, tz);
    const [ra, rb, rc] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: a.id } }),
      db.user.findUniqueOrThrow({ where: { id: b.id } }),
      db.user.findUniqueOrThrow({ where: { id: c.id } }),
    ]);
    check('bugün açan kullanıcıya hatırlatma işaretlenmez', ra.streakReminderDate !== today);
    check('kırılma riskindeki kullanıcıya hatırlatma işaretlenir', rb.streakReminderDate === today);
    check('serisi olmayan kullanıcıya hatırlatma işaretlenmez', rc.streakReminderDate !== today);

    // Aynı gün ikinci çağrı: zaten işaretlendiği için tekrar dokunulmaz (idempotent)
    await db.user.update({ where: { id: b.id }, data: { streakReminderDate: today } });
    await runStreakReminders(a.t, now);
    const rb2 = await db.user.findUniqueOrThrow({ where: { id: b.id } });
    check('aynı gün tekrar çağrılırsa hâlâ aynı gün işaretli', rb2.streakReminderDate === today);
  });

  it('yerel saat 20:00den önce kırılma riski olsa da hatırlatma gönderilmez', async () => {
    const b = await makeUser('Streak7', 'male', 'female');
    const db = await testDb();
    const tz = 180;
    // "Şimdi" = yerel saat 10:00 (UTC 07:00, +180dk = 10:00 yerel) — henüz erken
    const now = new Date('2026-05-05T07:00:00.000Z');
    const yesterday = localDateStr(new Date(now.getTime() - 86_400_000), tz);
    await db.user.update({ where: { id: b.id }, data: { tzOffsetMin: tz, currentStreak: 2, longestStreak: 2, lastStreakDate: yesterday, streakReminderDate: null } });

    await runStreakReminders(b.t, now);

    const today = localDateStr(now, tz);
    const rb = await db.user.findUniqueOrThrow({ where: { id: b.id } });
    check('erken saatte hatırlatma işaretlenmez', rb.streakReminderDate !== today);
  });
});
