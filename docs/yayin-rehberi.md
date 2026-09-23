# MeetPoint · Yayın rehberi

Bu rehber, yayına çok yakın uygulanacak adımları toplar. Şu an sistem lokalde çalışıyor; bu adımlar henüz uygulanmadı.

## 0. Yayından önce hazır olması gerekenler

| Gereken | Neden | Nereden |
|---|---|---|
| Şirket | Mağaza hesapları, para çekme ödemeleri, yasal metinler | Muhasebeci / avukat |
| Alan adı (ör. `meetpoint.app`) | HTTPS, e-posta, mağaza gizlilik linki | Herhangi bir alan adı firması |
| Google Play geliştirici hesabı ($25, tek sefer) | Android yayını | play.google.com/console |
| Apple Developer hesabı ($99/yıl) | iOS yayını | developer.apple.com |
| RevenueCat projesi | Jeton satışı | app.revenuecat.com |
| Firebase projesi | Push bildirimleri | console.firebase.google.com |
| Agora projesi | Sesli/görüntülü arama | console.agora.io |
| SMTP (ör. Brevo, Postmark, Amazon SES) | Doğrulama kodları | Seçilen servis |
| Avukat onaylı yasal metinler | `server/legal/*.html` şu an TASLAK | Avukat |

## 1. Veritabanı: SQLite → PostgreSQL (tek seferlik)

Lokal geliştirme SQLite ile yapılıyor. Yayında PostgreSQL kullanılacak:

1. `server/prisma/schema.prisma` içinde `provider = "sqlite"` satırını `provider = "postgresql"` yap.
2. `server/prisma/migrations` klasörünü sil (içindeki SQL SQLite'a özel).
3. Boş bir PostgreSQL veritabanına karşı tek bir başlangıç migration'ı oluştur:

```bash
DATABASE_URL="postgresql://meetpoint:SIFRE@localhost:5432/meetpoint" npx prisma migrate dev --name init
```

4. Sunucuda sadece `npx prisma migrate deploy` çalıştırılır (asla `migrate dev` değil).

## 2. Sunucu (VPS)

Ubuntu 22.04+ varsayımıyla. Node 24, PostgreSQL, nginx ve certbot gerekir.

```bash
sudo apt update && sudo apt install -y postgresql nginx certbot python3-certbot-nginx
```

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs
```

Klasör yapısı: kod `/opt/meetpoint/server/`, kullanıcı dosyaları ayrı bir yerde `/opt/meetpoint-data/` altında (kod güncellenirken silinmesin).

`/opt/meetpoint/server/.env` (örnek için `server/.env.example`):

```
NODE_ENV=production
DATABASE_URL="postgresql://meetpoint:SIFRE@localhost:5432/meetpoint"
JWT_SECRET="<openssl rand -hex 32 çıktısı>"
PORT=4000
UPLOAD_DIR=/opt/meetpoint-data/uploads
PRIVATE_UPLOAD_DIR=/opt/meetpoint-data/private-uploads
SMTP_HOST=... SMTP_USER=... SMTP_PASS=...
REVENUECAT_WEBHOOK_AUTH="Bearer <uzun-rastgele-metin>"
REVENUECAT_SECRET_KEY=sk_...
AGORA_APP_ID=... AGORA_APP_CERT=...
FIREBASE_SERVICE_ACCOUNT=/opt/meetpoint-data/firebase-service-account.json
```

`NODE_ENV=production` iken zorunlu ayarlardan biri eksikse sunucu **açılmaz** ve eksikleri listeler (JWT_SECRET, SMTP, RevenueCat webhook). Ayrıca test jeton yükleme ucu kapanır ve IP sınırları sıkılaşır.

Derleme ve başlatma:

```bash
cd /opt/meetpoint/server && npm ci && npx prisma migrate deploy && npm run build
```

`/etc/systemd/system/meetpoint.service`:

```
[Unit]
Description=MeetPoint API
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/meetpoint/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
User=www-data
EnvironmentFile=/opt/meetpoint/server/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now meetpoint.service
```

nginx (`/etc/nginx/sites-available/meetpoint`, alan adı `api.meetpoint.app` varsayımıyla). WebSocket (Socket.IO) için `Upgrade` başlıkları şart:

```
server {
  server_name api.meetpoint.app;
  client_max_body_size 12m;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/meetpoint /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx && sudo certbot --nginx -d api.meetpoint.app
```

Yönetim paneli: `https://api.meetpoint.app/admin`. İlk yönetici hesabını veritabanında `isAdmin = true` yaparak aç; seed yayında **çalıştırılmaz**.

## 3. Yedekleme

Her gece veritabanı ve kullanıcı dosyaları:

```
0 3 * * * pg_dump meetpoint | gzip > /opt/meetpoint-backups/db-$(date +\%F).sql.gz && tar czf /opt/meetpoint-backups/files-$(date +\%F).tgz -C /opt/meetpoint-data . && find /opt/meetpoint-backups -mtime +14 -delete
```

## 4. Uygulama derlemesi

Sunucu adresi ve mağaza anahtarları derleme sırasında verilir:

```bash
flutter build appbundle --dart-define=API_URL=https://api.meetpoint.app --dart-define=REVENUECAT_ANDROID_KEY=goog_xxx --dart-define=APP_VERSION=1.0.0
```

```bash
flutter build ipa --dart-define=API_URL=https://api.meetpoint.app --dart-define=REVENUECAT_IOS_KEY=appl_xxx --dart-define=APP_VERSION=1.0.0
```

Firebase için bir kez `flutterfire configure` çalıştırılır (`lib/firebase_options.dart` şu an yer tutucu). iOS için `ios/Podfile` içine kamera ve mikrofon izin makroları eklenir (README → Agora kurulumu).

## 5. Yayın günü kontrol listesi

- [ ] Yasal metinler avukat onaylı, şirket bilgileri eklendi
- [ ] `https://api.meetpoint.app/health` → `{"ok":true}`
- [ ] Gerçek telefonda: kayıt → e-posta kodu geldi
- [ ] Sandbox satın alma → jeton geldi, yönetimde "Sandbox" etiketiyle görünüyor
- [ ] İki telefonla sesli ve görüntülü arama: ses/görüntü var, dakika ücreti düşüyor
- [ ] Push bildirimi: eşleşme, mesaj, gelen arama
- [ ] Yönetim panelinde Hatalar sekmesi boş
- [ ] Gece yedeği oluştu
