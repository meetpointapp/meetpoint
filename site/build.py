"""vibeupme.com tanıtım sitesi üretici. Çalıştırma:  python site/build.py
Çıktı: site/index.html (Türkçe) ve site/en/index.html (İngilizce) + site/assets/ (ikon, paylaşım görseli).
Statik dosyalardır: Cloudflare Pages, Netlify, OWEB hosting ya da nginx ile aynen yayınlanır; sunucu kodu gerekmez.
Metinleri değiştirmek için aşağıdaki TEXT sözlüğünü düzenleyip betiği yeniden çalıştırın.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
API = "https://api.vibeupme.com"  # yasal metinler ve hesap silme sayfası API sunucusundan gelir
MAIL = "destek@vibeupme.com"

# ---------------------------------------------------------------- görseller
assets = ROOT / "assets"
assets.mkdir(exist_ok=True)
icon = Image.open(REPO / "app/assets/icon/icon.png").convert("RGBA")
for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (48, "favicon.png")]:
    icon.resize((size, size), Image.LANCZOS).save(assets / name)
Image.open(REPO / "app/assets/icon/logo.png").convert("RGBA").save(assets / "logo.png")
Image.open(REPO / "tools/brand/social/paylasim-1200x630.png").convert("RGB").save(assets / "og.png")

# ---------------------------------------------------------------- metinler
TEXT = {
    "tr": {
        "lang": "tr", "other": "en", "other_label": "EN", "other_href": "/en/", "self_href": "/",
        "title": "VibeUpMe · Kaydırma değil, frekans",
        "desc": "Burcun, müziğin, ilgi alanların ve vibe'ın tutan insanlarla tanış. Beğenmek için karta basılı tut. Eşleşince sohbet ücretsiz.",
        "nav_how": "Nasıl çalışır", "nav_features": "Özellikler", "nav_faq": "SSS", "nav_cta": "Yakında",
        "eyebrow": "Yeni nesil tanışma uygulaması",
        "h1a": "Kaydırma değil,", "h1b": "frekans.",
        "lead": "Burcun, müziğin, ilgi alanların ve vibe'ın tutan insanlarla tanış. Beğenmek için karta sadece basılı tut.",
        "soon": "Google Play ve App Store'da çok yakında",
        "badge_play": "Google Play", "badge_ios": "App Store", "badge_soon": "Yakında",
        "demo_note": "Örnek ekran", "freq_word": "frekans", "demo_match": "Aslan × Koç", "demo_meta": "İstanbul · 3 km", "demo_job": "Grafik tasarımcı", "demo_t1": "Fotoğrafçılık", "demo_t2": "Kahve", "demo_t3": "Indie",
        "trust1": "18 yaş ve üzeri", "trust2": "Doğrulanmış profiller", "trust3": "Eşleşince sohbet ücretsiz",
        "how_h": "Üç adımda tanış", "how_p": "Sonsuz kaydırma yok. Önce uyumu görürsün, sonra ne kadar ilgilendiğini sen belirlersin.",
        "s1_h": "Frekansı gör", "s1_p": "Her profilde ilgi alanı, burç, müzik, vibe ve aradığınız şey birleşip tek bir uyum frekansı olur. Dokununca nedenini görürsün.",
        "s2_h": "Basılı tut", "s2_p": "Karta basılı tut: Merak, İlgi, Tutku. Ne kadar tutarsan beğenin o güçte gider, karşı taraf ilgini görür.",
        "s3_h": "Eşleş, konuş", "s3_p": "İkiniz de frekansı yakalayınca eşleşirsiniz. Sohbet ücretsizdir, sesli ve görüntülü arama da bir dokunuş uzakta.",
        "tier1": "Merak", "tier2": "İlgi", "tier3": "Tutku",
        "feat_h": "Sıradan bir uygulama değil", "feat_p": "Kaydırmanın sıkıcılığını bıraktık. Daha anlamlı bir keşif için tasarladık.",
        "f1_h": "Uyum frekansı", "f1_p": "40 ile 98 arası tek bir sayı ve arkasındaki nedenler. Gizemli bir algoritma değil, görebildiğin kurallar.",
        "f2_h": "Moda özel kartlar", "f2_p": "Astroloji'de yıldızlı gökyüzü, Müzik'te ekolayzır, İlgi'de yüzen baloncuklar, Vibe'da nefes alan aura.",
        "f3_h": "Mavi tikli profiller", "f3_p": "Selfie doğrulamasıyla gerçek kişileri ayırt et. Sosyal akışta paylaşım ve yorum doğrulanmış profillere özel.",
        "f4_h": "Doğruluk mu Cesaret mi", "f4_p": "Eşleşmeden önce ya da sonra, aranızdaki buzu kıran 10 soruluk romantik bir oyun.",
        "f5_h": "Sosyal akış", "f5_p": "Yazı paylaş, takip et, yorum yap. Tanışmanın profilden ibaret olmadığı bir topluluk.",
        "f6_h": "Sesli ve görüntülü arama", "f6_p": "Eşleştiğin kişiyle uygulamadan çıkmadan konuş. Küçük kendi görüntünü istediğin köşeye taşı.",
        "safe_h": "Güvenle tanış", "safe_p": "Verilerin KVKK kapsamında işlenir. Hesabını ve verilerini istediğin an silebilirsin. Şikayet, engelleme ve moderasyon her adımda yanında.",
        "safe_link": "Hesap silme", "priv": "Gizlilik Politikası", "terms": "Kullanım Koşulları", "community": "Topluluk Kuralları",
        "faq_h": "Sık sorulanlar",
        "q1": "VibeUpMe ücretsiz mi?", "a1": "Uygulamayı indirmek ve eşleşme sonrası sohbet etmek ücretsizdir. Süper beğeni, öne çıkma gibi ekstralar jetonla alınır, hiçbiri zorunlu değil.",
        "q2": "Frekans nasıl hesaplanıyor?", "a2": "İkinizin profilindeki ortak ilgi alanları, burç uyumu, müzik zevki, vibe testi sonucu ve aradığınız ilişki türü karşılaştırılır. Yapay zekâ kullanılmaz, kurallar açıktır ve karta dokununca nedenini görürsün.",
        "q3": "Kimler kullanabilir?", "a3": "VibeUpMe 18 yaş ve üzeri içindir.",
        "q4": "Verilerim güvende mi?", "a4": "Verilerin KVKK kapsamında işlenir, fotoğraflar süreli ve imzalı adreslerle sunulur, istediğin an hesabını silebilirsin.",
        "q5": "Ne zaman çıkıyor?", "a5": "Android ve iOS sürümleri çok yakında mağazalarda. Hazır olunca bu sayfada duyuracağız.",
        "foot_tag": "Aynı frekansta buluşalım.", "foot_contact": "İletişim", "rights": "Tüm hakları saklıdır.",
        "foot_sections": "Sayfa", "foot_legal": "Yasal",
    },
    "en": {
        "lang": "en", "other": "tr", "other_label": "TR", "other_href": "/", "self_href": "/en/",
        "title": "VibeUpMe · Not swiping. Frequency.",
        "desc": "Meet people who match your zodiac, music, interests and vibe. Press and hold a card to like it. Chat is free once you match.",
        "nav_how": "How it works", "nav_features": "Features", "nav_faq": "FAQ", "nav_cta": "Coming soon",
        "eyebrow": "A new way to meet people",
        "h1a": "Not swiping.", "h1b": "Frequency.",
        "lead": "Meet people whose zodiac, music, interests and vibe match yours. To like someone, just press and hold their card.",
        "soon": "Coming very soon to Google Play and the App Store",
        "badge_play": "Google Play", "badge_ios": "App Store", "badge_soon": "Soon",
        "demo_note": "Sample screen", "freq_word": "frequency", "demo_match": "Leo × Aries", "demo_meta": "Istanbul · 3 km", "demo_job": "Graphic designer", "demo_t1": "Photography", "demo_t2": "Coffee", "demo_t3": "Indie",
        "trust1": "18+ only", "trust2": "Verified profiles", "trust3": "Chat is free once you match",
        "how_h": "Meet in three steps", "how_p": "No endless swiping. You see the match first, then decide how much you care.",
        "s1_h": "See the frequency", "s1_p": "Interests, zodiac, music, vibe and what you're looking for combine into one compatibility frequency. Tap it to see why.",
        "s2_h": "Press and hold", "s2_p": "Press and hold a card: Curious, Interested, Passion. The longer you hold, the stronger your like, and they see your interest.",
        "s3_h": "Match, talk", "s3_p": "When you both catch the frequency, you match. Chat is free, and voice and video calls are one tap away.",
        "tier1": "Curious", "tier2": "Interested", "tier3": "Passion",
        "feat_h": "Not your usual app", "feat_p": "We left the boredom of swiping behind and designed for more meaningful discovery.",
        "f1_h": "Compatibility frequency", "f1_p": "A single number from 40 to 98 and the reasons behind it. Not a mystery algorithm, rules you can see.",
        "f2_h": "Mode-themed cards", "f2_p": "A starry sky for Astrology, an equalizer for Music, floating bubbles for Interests, a breathing aura for Vibe.",
        "f3_h": "Verified profiles", "f3_p": "Tell real people apart with selfie verification. Posting and commenting in the social feed is for verified profiles.",
        "f4_h": "Truth or Dare", "f4_p": "A 10-question romantic game that breaks the ice, before or after you match.",
        "f5_h": "Social feed", "f5_p": "Post, follow, comment. A community where meeting people is more than a profile.",
        "f6_h": "Voice and video calls", "f6_p": "Talk to your match without leaving the app. Drag your little self-view to any corner.",
        "safe_h": "Meet safely", "safe_p": "Your data is processed under Turkish data protection law (KVKK). Delete your account and data any time. Reporting, blocking and moderation are with you at every step.",
        "safe_link": "Delete account", "priv": "Privacy Policy", "terms": "Terms of Use", "community": "Community Guidelines",
        "faq_h": "Frequently asked",
        "q1": "Is VibeUpMe free?", "a1": "Downloading the app and chatting after a match is free. Extras like super likes and boosts use coins, and none of them are required.",
        "q2": "How is the frequency calculated?", "a2": "We compare shared interests, zodiac compatibility, music taste, your vibe test result and what each of you is looking for. No AI is involved, the rules are open, and tapping a card shows why.",
        "q3": "Who can use it?", "a3": "VibeUpMe is for people aged 18 and over.",
        "q4": "Is my data safe?", "a4": "Your data is processed under KVKK, photos are served with signed, expiring links, and you can delete your account any time.",
        "q5": "When is it launching?", "a5": "Android and iOS versions are coming very soon. We'll announce it on this page.",
        "foot_tag": "Let's meet on the same frequency.", "foot_contact": "Contact", "rights": "All rights reserved.",
        "foot_sections": "Page", "foot_legal": "Legal",
    },
}

TEMPLATE = (ROOT / "template.html").read_text(encoding="utf-8")


def render(lang: str) -> str:
    t = TEXT[lang]
    html = TEMPLATE
    for k, v in {**t, "api": API, "mail": MAIL, "base": "../" if lang == "en" else ""}.items():
        html = html.replace(f"[[{k}]]", v)
    assert "[[" not in html, [s for s in html.split("[[")[1:2]]
    return html


(ROOT / "index.html").write_text(render("tr"), encoding="utf-8")
(ROOT / "en").mkdir(exist_ok=True)
(ROOT / "en" / "index.html").write_text(render("en"), encoding="utf-8")
print("site hazır:", ROOT)
