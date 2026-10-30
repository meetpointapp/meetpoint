# VibeUpMe yayın sunucusu kurulumu ve ölçekleme

Hedef: tek güçlü sunucuyla (4 çekirdek, 16 GB RAM, NVMe) başlayıp, büyüdükçe makine ekleyerek onbinlerce eşzamanlı kullanıcıya çıkmak. Kod buna hazır: sayaçlar, anlık olaylar ve fotoğraflar tek makineye bağlı değil.

## 1. Mimari

```
Telefon / web ──► Cloudflare (DNS, TLS, /media önbelleği)
                      │
                   nginx :443  ──►  pm2 cluster (3 Node süreci, :4000)
                                        │           │            │
                                   PostgreSQL     Redis     R2 / S3 (fotoğraflar)
                                   (veri)    (sayaç, anlık)   (genel + özel kova)
```

| Bileşen | Görevi | Ölçekleme yolu |
|---|---|---|
| Node API (pm2 cluster) | HTTP + Socket.IO | süreç sayısı, sonra ek sunucu + yük dengeleyici |
| PostgreSQL | tüm kalıcı veri | sonra ayrı makine, ardından okuma kopyası |
| Redis | hız sınırı sayaçları, Socket.IO yayını, çevrimiçi durum | ayrı makine |
| R2 / S3 | profil, sohbet, doğrulama fotoğrafları | sınırsız, ek iş yok |
| Cloudflare | TLS, DDoS, `/media` önbelleği | ek iş yok |

Redis ve S3 **isteğe bağlıdır**: ortam değişkeni yoksa sistem eski davranışa döner (PostgreSQL sayaçları, yerel disk). Yayında ikisini de açın; sunucu açılırken eksikse uyarı yazar.

## 2. Kurulum adımları

1. **Alan adı:** `api.vibeupme.com` A kaydını sunucu IP'sine yönlendirin (Cloudflare kullanıyorsanız önce "DNS only", sertifika alındıktan sonra proxy açılır).
2. **Kodu alın:** `git clone` ile `/opt/vibeupme` içine (içinde `server/` ve `docs/` klasörleri olacak).
3. **Betik:** `sudo bash /opt/vibeupme/server/deploy/setup-ubuntu.sh`
   Paketleri, Node 24'ü, pm2'yi, PostgreSQL ve Redis ayarlarını, nginx yapılandırmasını ve güvenlik duvarını kurar. Parolalar `/opt/vibeupme/secrets/` altına yazılır.
4. **R2 kovaları:** Cloudflare R2'de iki kova açın: `vibeupme-public` (profil fotoğrafları), `vibeupme-private` (doğrulama, sohbet fotoğrafı, veri dışa aktarma). **İkisi de herkese açık OLMAMALI**: uygulama dosyaları API üzerinden, imzalı adresle sunar. Bir API anahtarı oluşturup `.env`'e yazın.
5. **Ortam dosyası:** `server/deploy/.env.production.example` dosyasını `/opt/vibeupme/server/.env` olarak kopyalayın (`chmod 600`), doldurun. `JWT_SECRET`, `MEDIA_URL_SECRET`, `FIELD_ENCRYPTION_KEY` için: `openssl rand -hex 32`. **`FIELD_ENCRYPTION_KEY` ve `JWT_SECRET` yedeklenmeli, kaybolursa şifreli veriler geri gelmez.**
6. **Uygulama (vibeupme kullanıcısıyla):**
   ```bash
   cd /opt/vibeupme/server
   npm ci
   npx prisma migrate deploy
   npm run build
   npm run redis:check          # hepsi OK olmalı; takılırsa hangi adım olduğunu yazar
   pm2 start deploy/ecosystem.config.cjs --env production
   pm2 save
   ```
7. **TLS:** `certbot --nginx -d api.vibeupme.com`, sonra `nginx -t && systemctl reload nginx`.
8. **Kontrol:** `curl https://api.vibeupme.com/health` → `{"ok":true,"scheduler":"leader"|"follower"}`. Üç süreçten yalnızca biri `leader` olur.

## 2b. Tanıtım sitesi (vibeupme.com)

`site/` klasörü statik bir tanıtım sitesidir (Türkçe `/`, İngilizce `/en/`); sunucu ve veritabanı gerektirmez, uygulama sunucusundan bağımsız yayınlanır.

- **Yeniden üretme:** metinler `site/build.py` içindeki `TEXT` sözlüğünde; değiştirince `python site/build.py`.
- **Yerel önizleme:** `cd site && python -m http.server 8090`.
- **Yayınlama (önerim):** Cloudflare Pages'e depoyu bağla, "build command": `python site/build.py` (ya da hiç yok, `site/` zaten üretilmiş dosyaları içerir), "output directory": `site`. Alan adı olarak `vibeupme.com` ve `www` eklenir. Alternatif: `site/` klasörünü OWEB hosting'e ya da sunucudaki nginx'e (`root /opt/vibeupme/site;`) kopyalamak.
- **DNS:** `vibeupme.com` (ve `www`) → Cloudflare Pages; `api.vibeupme.com` → API sunucusunun IP'si (A kaydı).
- **Bağlantılar:** gizlilik, koşullar, topluluk kuralları ve hesap silme bağlantıları `https://api.vibeupme.com/legal/...` ve `/account/delete` adreslerine gider; yani **bu bağlantılar API sunucusu yayına girince çalışır**. Mağaza ve Meta formlarında gizlilik adresi olarak `https://api.vibeupme.com/legal/privacy` verilir.
- **E-posta:** sitede iletişim adresi `destek@vibeupme.com`; bu posta kutusu açılmalı (alan adı sağlayıcısında ya da Cloudflare Email Routing ile mevcut bir adrese yönlendirme).
- Mağaza rozetleri "Yakında" görünür; uygulama yayına girince `site/template.html` içindeki rozetler mağaza bağlantılarına çevrilmeli.

## 3. Cloudflare önbelleği (fotoğraflar)

Fotoğraf adresleri (`/media/...?e=...&s=...`) imzalı ve süreli, yanıtlar `Cache-Control: public, immutable`. Cloudflare'de **Cache Rule**: `URI Path starts with /media/` → "Eligible for cache", "Respect origin TTL". Böylece bir fotoğrafa API yalnızca ilk istekte yanıt verir; sonrası Cloudflare'den gelir.

Cloudflare proxy açıkken gerçek istemci IP'si için nginx'te `real_ip` bloğunu açın (`nginx-vibeupme.conf` içinde yorum satırı).

## 4. Yedekleme (zorunlu)

Aynı disk yedek sayılmaz. Günlük `pg_dump`, başka bir yere (R2'de ayrı bir `vibeupme-backup` kovası ya da başka sağlayıcı):

```bash
# /etc/cron.d/vibeupme-backup  (her gün 04:00)
0 4 * * * postgres pg_dump -Fc vibeupme | gzip | rclone rcat r2:vibeupme-backup/db-$(date +\%F).sql.gz
```

Geri yükleme denemesini **yayından önce** bir kez yapın. Para ve bakiye kayıtları bu veritabanında.

## 5. İzleme

- `pm2 monit` ve `pm2 logs`: süreç CPU/bellek, hatalar.
- Yönetim panelindeki hata kayıtları (zaten var).
- PostgreSQL: `pg_stat_statements` açık; yavaş sorgular günlükte (`log_min_duration_statement = 500`):
  `SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;`
- Dış izleme: `/health` adresini UptimeRobot benzeri bir servisle 1 dakikada bir yoklayın.

## 6. Yük testi (yayından önce, staging'de)

Gerçek veritabanına sahte kullanıcı yazmayın. Staging'de:

```bash
cd server && npm run load:users -- 5000                 # 5000 hesap + 3 saatlik jeton (tools/loadtest/tokens.json)
node ../tools/loadtest/sockets.mjs https://staging-api.vibeupme.com 5000    # eşzamanlı Socket.IO bağlantısı
k6 run -e BASE_URL=https://staging-api.vibeupme.com -e VUS=500 tools/loadtest/k6-vibeupme.js
cd server && npm run load:users -- --cleanup            # sahte hesapları sil
```

Hedefler (k6 eşikleri): hata < %1, keşfet p95 < 800 ms, kaydırma p95 < 400 ms, hafif uçlar p95 < 250 ms.

**Ölçüm notu (geliştirme makinesi, tek süreç, `tsx`, küçük veri):** keşfet ≈ 260 istek/sn, hafif uçlar ≈ 600–900 istek/sn. Yayın derlemesi (Linux, derlenmiş JS) bundan hızlı olur; yine de gerçek sınırı staging ölçümü belirler, buradaki sayılar tahmin değildir ama üretim sayısı da değildir.

## 7. Büyüme basamakları (ne zaman ne yapılır)

| İşaret | Yapılacak |
|---|---|
| API sürecinde CPU sürekli > %70 | `API_INSTANCES` artır (çekirdek sayısı − 1) |
| PostgreSQL CPU > %60 ya da `pg_stat_statements`'ta keşfet sorgusu başta | veritabanını **ayrı makineye** al (`DATABASE_URL`), `shared_buffers`'ı o makineye göre ayarla |
| Tek API makinesi yetmiyor | ikinci/üçüncü API makinesi + yük dengeleyici; Redis ve PostgreSQL ortak. Kod zaten çoklu sunucuya hazır (zamanlayıcı lider kilidi, Redis adaptörü) |
| Okuma yükü yazmadan çok fazla | PostgreSQL okuma kopyası (keşfet gibi okuma ağırlıklı uçlar için) |
| ~10.000+ eşzamanlı socket | Socket.IO'yu ayrı makinelere böl (`/socket.io` yolunu nginx'te ayrı upstream'e yönlendir) |
| Redis bellek > %70 | ayrı Redis makinesi |

## 8. Bilinen sınırlar ve sonraki adımlar

- **Her kimlik doğrulamalı istek veritabanında oturumu okur** (`auth.ts authenticate`). Yüksek trafikte kısa süreli (5 sn) bellek önbelleği düşünülebilir, ancak yasaklama/oturum kapatma gecikmesine yol açar; ölçüm gerektirirse yapılmalı.
- **Keşfet sorgusu** her çağrıda hesaplanır. Yük arttığında aday havuzunu önceden hesaplayıp Redis'te tutmak (kullanıcı başına kısa süreli) en büyük kazancı verir.
- **Fotoğraf dönüştürme** (`sharp`) API sürecinde çalışır. Kayıt patlamalarında ayrı bir iş kuyruğuna alınmalı.
- Redis kodu yerelde gerçek Redis olmadan yazıldı; **sunucuda `npm run redis:check` geçmeden yayına çıkmayın.**
