"""VibeUpMe sosyal medya görselleri (Facebook / Instagram / X ...).

Kaynak: app/assets/icon/logo.png (şeffaf, kalp + kamera) ve make_icons.py ile aynı koyu sahne.
Çıktılar (tools/brand/social/):
  profil-1024.png   Profil fotoğrafı (kare; platform daire keser, logo güvenli bölgede)
  kapak-1640x624.png  Facebook sayfa kapağı (820x312 @2x). İçerik ortada: mobilde kenarlar kırpılır
  paylasim-1200x630.png  Bağlantı önizlemesi / gönderi görseli

Çalıştırma:  python tools/brand/make_social.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ICON = ROOT / "app" / "assets" / "icon"
OUT = Path(__file__).resolve().parent / "social"
OUT.mkdir(exist_ok=True)

BG_TOP = np.array([0x16, 0x0A, 0x1F], dtype=np.float32)
BG_BOTTOM = np.array([0x07, 0x04, 0x0C], dtype=np.float32)
ROSE = np.array([0xFF, 0x4D, 0x6D], dtype=np.float32)
AMBER = np.array([0xF5, 0xA5, 0x24], dtype=np.float32)
VIOLET = np.array([0x8B, 0x2F, 0xE0], dtype=np.float32)

logo = Image.open(ICON / "logo.png").convert("RGBA")
FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_SEMI = r"C:\Windows\Fonts\seguisb.ttf"


def radial(w: int, h: int, cx: float, cy: float, radius: float, power: float = 2.0) -> np.ndarray:
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((x - cx * w) ** 2 + (y - cy * h) ** 2) / (radius * max(w, h))
    return np.clip(1 - d, 0, 1) ** power


def scene(w: int, h: int, rose_at=(0.5, 0.5)) -> Image.Image:
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    t = np.clip((x / w) * 0.35 + (y / h) * 0.65, 0, 1)[..., None]
    out = BG_TOP * (1 - t) + BG_BOTTOM * t
    rose = radial(w, h, rose_at[0], rose_at[1], 0.62, 1.7)[..., None]
    violet = radial(w, h, 0.10, 1.0, 0.70, 1.8)[..., None]
    amber = radial(w, h, 0.92, 0.05, 0.55, 2.2)[..., None]
    out = out * (1 - 0.50 * rose) + ROSE * (0.50 * rose)
    out = out * (1 - 0.40 * violet) + VIOLET * (0.40 * violet)
    out = out * (1 - 0.14 * amber) + AMBER * (0.14 * amber)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def mark(width: int) -> Image.Image:
    return logo.resize((width, int(width * logo.height / logo.width)), Image.LANCZOS)


def paste_with_shadow(canvas: Image.Image, m: Image.Image, x: int, y: int) -> None:
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    alpha = m.split()[-1].point(lambda a: int(a * 0.55))
    sh.paste((0, 0, 0, 255), (x, y + int(canvas.height * 0.018)), alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(canvas.width * 0.012))
    canvas.alpha_composite(sh)
    canvas.alpha_composite(m, (x, y))


def gradient_text(draw_target: Image.Image, xy, text: str, font: ImageFont.FreeTypeFont) -> None:
    """Marka gradyanı (gül → turuncu) ile yazı."""
    bbox = font.getbbox(text)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    mask = Image.new("L", (tw + 8, th + 16), 0)
    ImageDraw.Draw(mask).text((4 - bbox[0], 4 - bbox[1]), text, font=font, fill=255)
    grad = np.zeros((mask.height, mask.width, 4), dtype=np.uint8)
    gx = np.linspace(0, 1, mask.width, dtype=np.float32)[None, :, None]
    c = ROSE * (1 - gx) + np.array([0xFF, 0x8A, 0x5B], dtype=np.float32) * gx
    grad[..., :3] = np.repeat(c, mask.height, axis=0).astype(np.uint8)
    grad[..., 3] = np.array(mask)
    draw_target.alpha_composite(Image.fromarray(grad, "RGBA"), (int(xy[0]), int(xy[1])))


# 1) Profil fotoğrafı: platform daire keser, logo dairenin içinde rahat kalsın
S = 1024
profile = scene(S, S)
m = mark(int(S * 0.56))
paste_with_shadow(profile, m, (S - m.width) // 2 + int(S * 0.012), (S - m.height) // 2)
profile.convert("RGB").save(OUT / "profil-1024.png")


def banner(w: int, h: int, name: str, mark_ratio: float, title_px: int, tag_px: int) -> None:
    img = scene(w, h, rose_at=(0.30, 0.5))
    m2 = mark(int(h * mark_ratio))
    gap = int(h * 0.08)
    f_title = ImageFont.truetype(FONT_BOLD, title_px)
    f_tag = ImageFont.truetype(FONT_SEMI, tag_px)
    title = "vibeupme"
    tag = "Kaydırma değil, frekans."
    tb = f_title.getbbox(title)
    gb = f_tag.getbbox(tag)
    text_w = max(tb[2] - tb[0], gb[2] - gb[0])
    total = m2.width + gap + text_w
    x0 = (w - total) // 2
    paste_with_shadow(img, m2, x0, (h - m2.height) // 2)
    tx = x0 + m2.width + gap
    block_h = (tb[3] - tb[1]) + int(title_px * 0.30) + (gb[3] - gb[1])
    ty = (h - block_h) // 2 - int(title_px * 0.06)
    gradient_text(img, (tx, ty), title, f_title)
    d = ImageDraw.Draw(img)
    d.text((tx - gb[0], ty + (tb[3] - tb[1]) + int(title_px * 0.30) - gb[1] + int(title_px * 0.10)), tag, font=f_tag, fill=(255, 255, 255, 215))
    img.convert("RGB").save(OUT / name)


# 2) Facebook kapağı (820x312 @2x). Mobilde kenarlar kırpıldığı için içerik dar tutuldu.
banner(1640, 624, "kapak-1640x624.png", mark_ratio=0.46, title_px=150, tag_px=50)
# 3) Bağlantı önizlemesi / gönderi görseli
banner(1200, 630, "paylasim-1200x630.png", mark_ratio=0.40, title_px=118, tag_px=40)
print("ok →", OUT)
