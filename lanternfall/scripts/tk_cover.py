#!/usr/bin/env python3
"""tk_cover.py <img> <out.jpg> "WHITE1|WHITE2" "ORANGE1|ORANGE2" "BADGE" "BOTTOM" [focus_x]"""
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np
W, H = 1080, 1920
FD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts")
def F(s, w):
    f = ImageFont.truetype(os.path.join(FD, "Inter.ttf"), s); f.set_variation_by_axes([14, w]); return f
src, out, wl, ol, badge, bottom = sys.argv[1:7]
fx = float(sys.argv[7]) if len(sys.argv) > 7 else 0.5
im = Image.open(src).convert("RGB"); w, h = im.size; s = max(W / w, H / h)
im = im.resize((int(w * s) + 1, int(h * s) + 1), Image.LANCZOS); w, h = im.size
x = int((w - W) * fx); im = im.crop((x, 0, x + W, H))
im = ImageEnhance.Brightness(im).enhance(1.3); im = ImageEnhance.Contrast(im).enhance(1.25)
a = np.asarray(im, np.float32); yy, xx = np.ogrid[:H, :W]
r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2); a *= (1 - 0.5 * np.clip(r - 0.5, 0, 1))[..., None]
im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
def T(y, t, f, c):
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).text((W / 2 + 6, y + 8), t, font=f, fill=(0, 0, 0, 200), anchor="mm")
    sh = sh.filter(ImageFilter.GaussianBlur(10)); im.paste(sh, (0, 0), sh)
    d.text((W / 2, y), t, font=f, fill=c, anchor="mm", stroke_width=10, stroke_fill=(10, 8, 6))
def fit(t, size):
    f = F(size, 900)
    while d.textlength(t, font=f) > W - 90: size -= 4; f = F(size, 900)
    return f
y = 330
for t in wl.split("|"): T(y, t, fit(t, 120), (255, 255, 255)); y += 140
y += 30
for t in ol.split("|"): T(y, t, fit(t, 120), (255, 178, 72)); y += 140
if badge:
    f = F(70, 900); bw = d.textlength(badge, font=f) / 2 + 50
    d.rounded_rectangle([W / 2 - bw, 1560, W / 2 + bw, 1680], radius=20, fill=(255, 178, 72)); d.text((W / 2, 1620), badge, font=f, fill=(20, 14, 8), anchor="mm")
d.text((W / 2, 1760), bottom, font=F(46, 800), fill=(255, 255, 255), anchor="mm", stroke_width=6, stroke_fill=(0, 0, 0))
im.save(out, quality=92)
