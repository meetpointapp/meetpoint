# Arayüz turları

Uygulamayı gerçek tarayıcıda (headless Edge) adım adım gezip ekran görüntüsü alan betikler ve `docs/faz*-onizleme.png` kolajlarını üreten betikler. Otomatik testlerin yerine değil, görsel kontrol ve dokümantasyon için.

Hazırlık (bir kez):

```bash
cd tools/ui-tours && npm install
```

Çalıştırmadan önce üç şey açık olmalı:

1. Geliştirme sunucusu, seed'li veriyle: `cd server && npm run db:seed && npm run dev`
   Arama turu (`faz6.mjs`) için sunucu `CALL_BILLING_SECONDS=6 CALL_RING_SECONDS=40` ile başlatılmalı.
2. Web derlemesi: `cd app && flutter build web`
3. Web sunucusu: `cd tools/ui-tours && npm run serve` (http://localhost:8080)

Sonra örneğin:

```bash
node faz7.mjs
```

Ekran görüntüleri `shots/` klasörüne düşer (git'e girmez). Kolaj: `node collage7.mjs` → `docs/faz7-onizleme.png`.

| Betik | İçerik |
|---|---|
| `onboarding.mjs` | Kayıt sihirbazı |
| `tour.mjs`, `tour2.mjs`, `tour3.mjs` | Faz 1–2 ana ekranlar |
| `dark.mjs`, `lang.mjs` | Karanlık mod, İngilizce |
| `badge.mjs` | Mavi tik görünümü |
| `faz3.mjs` … `faz7.mjs` | İlgili fazın akışları |
| `faz14.mjs`, `web14.mjs` | Satın alma onayı, bildirimler, yardım ve destek, panel Destek sekmesi, web sayfaları |
| `faz15.mjs` | Arama + hemen kapatma (adil ücretlendirme), arama geçmişinden itiraz, sohbette mesaj gönderme |
| `admin.mjs` | Yönetim paneli |
| `icon.mjs` | Uygulama ikonunu üretir (`app/assets/icon`) |
| `collage*.mjs` | Faz önizleme kolajları |

Headless tarayıcıda bazı fotoğraflar siyah görünebilir (WebGL kısıtı); uygulama hatası değildir.
