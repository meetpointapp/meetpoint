"""Give the flat vector world a painterly surface: large tonal blotches, brush streaks, paper grain."""
import sys, numpy as np
from PIL import Image, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB"); W, H = im.size
rng = np.random.default_rng(5)
def field(w, h, blur, stretch=(1, 1)):
    n = Image.fromarray(rng.normal(128, 50, (h, w)).clip(0, 255).astype(np.uint8))
    n = n.resize((w * stretch[0], h * stretch[1]), Image.BICUBIC).filter(ImageFilter.GaussianBlur(blur))
    return n.resize((W, H), Image.BICUBIC)
big = field(W // 120, H // 120, 1.2)            # large tonal variation
streak = field(W // 24, H // 8, 0.8, (1, 1))    # horizontal brush strokes (stretched)
streak = streak.filter(ImageFilter.BoxBlur(3))
grain = field(W // 3, H // 3, 0.6)
out = np.empty((H, W, 3), np.uint8)
for y0 in range(0, H, 1000):
    y1 = min(H, y0 + 1000)
    a = np.asarray(im.crop((0, y0, W, y1))).astype(np.float32)
    m = 1 + (np.asarray(big.crop((0, y0, W, y1))).astype(np.float32) - 128) / 128 * 0.09 \
          + (np.asarray(streak.crop((0, y0, W, y1))).astype(np.float32) - 128) / 128 * 0.05 \
          + (np.asarray(grain.crop((0, y0, W, y1))).astype(np.float32) - 128) / 128 * 0.035
    a *= m[..., None]
    # warm the shadows slightly, keep palette unified
    lum = a.mean(axis=2, keepdims=True)
    a += (1 - np.clip(lum / 160, 0, 1)) * np.array([6, 2, -4], np.float32)
    out[y0:y1] = np.clip(a, 0, 255).astype(np.uint8)
Image.fromarray(out).save(dst)
print("ok")

# second pass: hand-painted rock texture (tiled, luminance only, stronger on bright rock than in dark rooms)
if len(sys.argv) > 3:
    tex = Image.open(sys.argv[3]).convert("L")
    tex = tex.resize((1400, 1400), Image.BICUBIC)
    tv = np.asarray(tex).astype(np.float32); tv = (tv - tv.mean()) / (tv.std() + 1e-3)
    th, tw = tv.shape
    img = np.asarray(Image.open(dst)).astype(np.float32)
    for y0 in range(0, H, 1000):
        y1 = min(H, y0 + 1000)
        ys = (np.arange(y0, y1) % th)[:, None]; xs = (np.arange(W) % tw)[None, :]
        t = tv[ys, xs]
        a = img[y0:y1]
        lum = a.mean(axis=2)
        rows = np.clip((np.arange(y0, y1) - 1810) / 40.0, 0, 1)[:, None]   # underground only (ground line y=900*SS)
        k = np.clip((lum - 50) / 90, 0, 1) * 0.085 * rows
        a *= (1 + np.clip(t, -3, 2) * k)[..., None]
        img[y0:y1] = a
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(dst)
    print("tex ok")
