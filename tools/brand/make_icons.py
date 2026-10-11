"""VibeUpMe marka görselleri: uygulama ikonu + açılış ekranı görseli (koyu, zengin görünüm).

Kaynak: app/assets/icon/logo.png (şeffaf, kalp + oynatma üçgeni).
Çıktılar (app/assets/icon/):
  icon.png          1024x1024 tam kaplı ikon (iOS / Android eski / web)
  icon_bg.png       Android uyarlanabilir ikon arka planı (logo yok)
  icon_fg.png       Android uyarlanabilir ikon ön planı (logo, şeffaf, güvenli bölgede)
  splash_logo.png   Açılış ekranı görseli (logo + yumuşak parıltı, şeffaf)

Çalıştırma:  python tools/brand/make_icons.py   (sonra app/ içinde:
  dart run flutter_launcher_icons && dart run flutter_native_splash:create)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
ICON = ROOT / "app" / "assets" / "icon"
SIZE = 1024

# Marka tonları: derin mürdüm zemin, sıcak gül parıltısı, altın vurgu
BG_TOP = np.array([0x16, 0x0A, 0x1F], dtype=np.float32)      # #160A1F
BG_BOTTOM = np.array([0x07, 0x04, 0x0C], dtype=np.float32)   # #07040C
GLOW_ROSE = np.array([0xFF, 0x4D, 0x6D], dtype=np.float32)   # marka gülü
GLOW_AMBER = np.array([0xF5, 0xA5, 0x24], dtype=np.float32)  # altın/amber
GLOW_VIOLET = np.array([0x8B, 0x2F, 0xE0], dtype=np.float32)  # derinlik için mor

logo = Image.open(ICON / "logo.png").convert("RGBA")


def gradient_bg(size: int) -> np.ndarray:
    """Köşegen koyu gradyan + hafif vinyet."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    t = (x * 0.35 + y * 0.65) / size
    t = np.clip(t, 0, 1)[..., None]
    return BG_TOP * (1 - t) + BG_BOTTOM * t


def radial(size: int, cx: float, cy: float, radius: float, power: float = 2.2) -> np.ndarray:
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    d = np.sqrt((x - cx * size) ** 2 + (y - cy * size) ** 2) / (radius * size)
    return np.clip(1 - d, 0, 1) ** power


def add_glow(bg: np.ndarray, size: int) -> np.ndarray:
    """Logonun arkasında geniş gül parıltısı + alt solda mor derinlik: düz zemin değil, zengin bir sahne."""
    out = bg.copy()
    rose = radial(size, 0.48, 0.50, 0.66, 1.7)[..., None]
    violet = radial(size, 0.12, 0.95, 0.70, 1.8)[..., None]
    amber = radial(size, 0.88, 0.12, 0.55, 2.2)[..., None]
    out = out * (1 - 0.50 * rose) + GLOW_ROSE * (0.50 * rose)
    out = out * (1 - 0.40 * violet) + GLOW_VIOLET * (0.40 * violet)
    out = out * (1 - 0.14 * amber) + GLOW_AMBER * (0.14 * amber)
    # üstten ince ışık (cam hissi)
    y = np.linspace(0, 1, size, dtype=np.float32)[:, None, None]
    sheen = np.clip(1 - y / 0.40, 0, 1) ** 2 * 0.05
    out = out + 255 * sheen
    return np.clip(out, 0, 255)


def to_image(arr: np.ndarray) -> Image.Image:
    return Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")


def fit_logo(width_ratio: float, canvas: int = SIZE) -> Image.Image:
    w = int(canvas * width_ratio)
    h = int(w * logo.height / logo.width)
    return logo.resize((w, h), Image.LANCZOS)


def place_logo(canvas: Image.Image, mark: Image.Image, cy: float = 0.5, shadow: bool = True) -> Image.Image:
    """Logoyu ortala (optik merkez: kalp solda ağır olduğu için hafif sağa)."""
    out = canvas.copy()
    x = (out.width - mark.width) // 2 + int(out.width * 0.012)
    y = int(out.height * cy - mark.height / 2)
    if shadow:
        # Yumuşak, koyu gölge: logo zeminden ayrılsın
        sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
        alpha = mark.split()[-1].point(lambda a: int(a * 0.55))
        sh.paste((0, 0, 0, 255), (x, y + int(out.height * 0.018)), alpha)
        sh = sh.filter(ImageFilter.GaussianBlur(out.width * 0.018))
        out = Image.alpha_composite(out, sh)
    out.alpha_composite(mark, (x, y))
    return out


# 1) Tam kaplı ikon
bg = to_image(add_glow(gradient_bg(SIZE), SIZE))
icon = place_logo(bg, fit_logo(0.58))
icon.convert("RGB").save(ICON / "icon.png")

# 2) Uyarlanabilir ikon: arka plan + ön plan (güvenli bölge ~%61)
to_image(add_glow(gradient_bg(SIZE), SIZE)).convert("RGB").save(ICON / "icon_bg.png")
fg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
fg = place_logo(fg, fit_logo(0.46), shadow=True)
fg.save(ICON / "icon_fg.png")

# 3) Açılış ekranı görseli: logo + yumuşak gül parıltısı (şeffaf)
CANVAS = 1152
halo = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
g = (radial(CANVAS, 0.5, 0.5, 0.30, 2.0) * 255 * 0.32).astype(np.uint8)
halo_arr = np.zeros((CANVAS, CANVAS, 4), dtype=np.uint8)
halo_arr[..., 0], halo_arr[..., 1], halo_arr[..., 2], halo_arr[..., 3] = 255, 77, 109, g
halo = Image.fromarray(halo_arr, "RGBA")
splash = place_logo(halo, fit_logo(0.40, CANVAS), shadow=False)
splash.save(ICON / "splash_logo.png")
print("ok", [p.name for p in ICON.glob("*.png")])
