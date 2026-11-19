#!/usr/bin/env python3
"""Build the Derinkuyu world raster: base drawing + texture + details.  world_build.py <out.png>"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
import ill_derinkuyu as B

def texture(im):
    W, H = im.size; a = np.asarray(im, np.float32); rng = np.random.default_rng(9)
    def noise(scale):
        n = rng.standard_normal((H // scale + 2, W // scale + 2)).astype(np.float32)
        return np.asarray(Image.fromarray(((n - n.min()) / (n.max() - n.min()) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255 - 0.5
    tex = noise(64) * 18 + noise(16) * 10 + noise(4) * 6
    GY = B.GY * B.SS
    mask = np.zeros((H, W), np.float32); mask[GY:] = 1
    a += (tex * mask)[..., None]
    y = np.arange(H, dtype=np.float32)[:, None]
    a *= (1 - np.clip((y - GY) / (H - GY), 0, 1) * 0.25 * mask)[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def details(im):
    d = ImageDraw.Draw(im, "RGBA"); S = lambda v: int(v * B.SS); rng = np.random.default_rng(3); OUT = (30, 22, 16)
    for i, y in enumerate(B.LEVY):
        for nx in (B.LX0 + 190, 1080, B.LX1 - 190):
            if i == 5 and nx == 1080: continue
            d.rounded_rectangle([S(nx - 18), S(y - 128), S(nx + 18), S(y - 88)], radius=S(16), fill=(32, 24, 18), outline=(90, 66, 48), width=S(2))
            d.ellipse([S(nx - 5), S(y - 104), S(nx + 5), S(y - 94)], fill=(255, 210, 120))
        if i in (2, 4, 6):
            x0 = rng.uniform(B.LX0 + 250, B.LX1 - 420)
            d.rectangle([S(x0), S(y - 6), S(x0 + 150), S(y)], fill=(150, 58, 48))
            for k in range(6): d.line([(S(x0 + 10 + k * 24), S(y - 6)), (S(x0 + 10 + k * 24), S(y))], fill=(210, 170, 90), width=S(2))
        if i in (3, 5, 7):
            for k in range(3):
                bx = B.LX0 + 260 + k * 60 + rng.uniform(-10, 10)
                d.pieslice([S(bx - 18), S(y - 34), S(bx + 18), S(y + 2)], 180, 360, fill=(170, 130, 70), outline=OUT, width=S(2))
        for k in range(40):
            cx = rng.uniform(B.LX0 + 40, B.LX1 - 40); cy = rng.uniform(y - 140, y - 30)
            d.line([(S(cx), S(cy)), (S(cx + rng.uniform(4, 10)), S(cy + rng.uniform(-3, 3)))], fill=(70, 52, 38, 110), width=S(2))
        if i in (1, 3):
            hx = B.LX1 - 80 if i % 2 == 0 else B.LX0 + 80
            d.polygon([(S(hx - 20), S(y - 140)), (S(hx + 20), S(y - 140)), (S(hx + 16), S(y - 70)), (S(hx - 16), S(y - 76))], fill=(120, 60, 50, 220))
    for fx in range(300, 2100, 46):
        if 760 < fx < 1100: continue
        d.line([(S(fx), S(B.GY - 24)), (S(fx), S(B.GY))], fill=(120, 90, 60), width=S(3))
    d.line([(S(300), S(B.GY - 18)), (S(2100), S(B.GY - 18))], fill=(120, 90, 60), width=S(2))
    return im

if __name__ == "__main__":
    details(texture(B.build_world())).save(sys.argv[1])
