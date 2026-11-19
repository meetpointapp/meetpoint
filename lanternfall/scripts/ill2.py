#!/usr/bin/env python3
"""Illustrated story short v2 (Derinkuyu): montage of illustrated shots + real photos, expressive characters
walking on real geometry, speech bubbles, camera shake, flashes, particles, SFX.
  ill2.py <project_dir>   (aud/line_NNN.wav, lines_in.json, real/ -> photos)"""
import sys, os, json, math, subprocess, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
from multiprocessing import Pool
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import ill_derinkuyu as BASE   # reuse static world + palette

W, H, FPS = 1080, 1920, 30
GY, LEVY, LX0, LX1, C = BASE.GY, BASE.LEVY, BASE.LX0, BASE.LX1, BASE.C
SS = BASE.SS
FONT = BASE.FONT
P = None; SHOTS = None; WORDS = None; WORLD = None; PHOTOS = {}


@functools.lru_cache(maxsize=32)
def font(size, w=800):
    return BASE.font(size, w)


def ease(x): return BASE.ease(x)


def lerp(a, b, k): return a + (b - a) * k


# ---------------- man path along real geometry ----------------
def build_path():
    pts = [(860, GY + 260), (1030, GY + 260),          # basement floor to wall
           (1080, GY + 250), (1400, GY + 250),          # through hole, tunnel
           (1460, LEVY[0]),                             # stairs down to level 0
           (LX0 + 40, LEVY[0]),                         # walk level 0 to left stair
           (LX0 + 140, LEVY[1]),                        # stairs to level 1
           (LX1 - 40, LEVY[1]), (LX1 - 140, LEVY[2])]
    seg = [0]
    for a, b in zip(pts, pts[1:]):
        seg.append(seg[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    return pts, seg


PATH, SEG = build_path()


def path_at(u):
    """u in [0, total length] -> (x, y, facing)"""
    u = max(0, min(u, SEG[-1]))
    for i in range(len(PATH) - 1):
        if u <= SEG[i + 1]:
            k = (u - SEG[i]) / max(SEG[i + 1] - SEG[i], 1e-6)
            (x0, y0), (x1, y1) = PATH[i], PATH[i + 1]
            return x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, (1 if x1 >= x0 else -1)
    x, y = PATH[-1]
    return x, y, 1


# ---------------- characters ----------------
def char(d, x, y, s, body, face=1, hair=None, cap=None, mustache=False, walk=False, phase=0.0, talk=False,
         lamp=False, torch=False, crouch=False, hammer=0.0, brow=0, shh=False, t=0.0, kid=False):
    """Chibi-style character; (x,y) = feet on screen; s = px per world unit."""
    k = 0.75 if kid else 1.0
    s = s * k
    leg = (22 if not crouch else 12) * s
    sw = math.sin(phase) * 7 * s if walk else 0
    bob = abs(math.sin(phase)) * 2 * s if walk else 0
    hip = y - leg - bob
    lw = max(2, int(6 * s))
    d.line([(x - 5 * s, hip), (x - 5 * s + sw, y)], fill=(55, 45, 40), width=lw)
    d.line([(x + 5 * s, hip), (x + 5 * s - sw, y)], fill=(55, 45, 40), width=lw)
    d.ellipse([x - 5 * s + sw - 5 * s, y - 3 * s, x - 5 * s + sw + 6 * s, y + 3 * s], fill=(45, 35, 30))
    d.ellipse([x + 5 * s - sw - 5 * s, y - 3 * s, x + 5 * s - sw + 6 * s, y + 3 * s], fill=(45, 35, 30))
    bh = 30 * s
    top = hip - bh
    d.rounded_rectangle([x - 14 * s, top, x + 14 * s, hip + 3 * s], radius=int(9 * s), fill=body)
    # head
    hr = 17 * s
    hx, hy = x + 2 * s * face, top - hr + 3 * s
    d.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=(236, 196, 158))
    if hair:
        d.pieslice([hx - hr, hy - hr, hx + hr, hy + hr * 0.6], 180, 360, fill=hair)
    if cap:
        d.pieslice([hx - hr - 1, hy - hr - 2, hx + hr + 1, hy + hr * 0.5], 180, 360, fill=cap)
        d.rounded_rectangle([hx - 2 * s if face > 0 else hx - 20 * s, hy - 7 * s, hx + 20 * s if face > 0 else hx + 2 * s, hy - 3 * s],
                            radius=int(2 * s), fill=cap)
    # eyes
    ex = hx + 5 * s * face
    for dx in (-6, 6):
        d.ellipse([ex + dx * s - 3.4 * s, hy - 3 * s, ex + dx * s + 3.4 * s, hy + 4 * s], fill=(255, 255, 255))
        d.ellipse([ex + dx * s - 1.8 * s + face * s, hy - 1 * s, ex + dx * s + 1.8 * s + face * s, hy + 3 * s], fill=(30, 25, 22))
        by = hy - 6 * s - brow * 2 * s
        d.line([(ex + dx * s - 4 * s, by + (brow * dx * 0.2) * s), (ex + dx * s + 4 * s, by - (brow * dx * 0.2) * s)],
               fill=(60, 45, 35), width=max(1, int(2 * s)))
    # mouth
    my = hy + 9 * s
    if talk and int(t * 9) % 2 == 0:
        d.ellipse([ex - 3 * s, my - 2 * s, ex + 3 * s, my + 4 * s], fill=(110, 40, 40))
    else:
        d.line([(ex - 3 * s, my), (ex + 3 * s, my)], fill=(110, 60, 50), width=max(1, int(2 * s)))
    if mustache:
        d.line([(ex - 6 * s, my - 2 * s), (ex + 6 * s, my - 2 * s)], fill=(70, 50, 40), width=max(2, int(3 * s)))
    # arms
    sx, sy = x + 4 * s * face, top + 7 * s
    out = None
    if shh:
        d.line([(sx, sy), (ex + 2 * s, my)], fill=body, width=lw)
        d.line([(ex + 2 * s, my - 9 * s), (ex + 2 * s, my + 2 * s)], fill=(236, 196, 158), width=max(2, int(3 * s)))
    elif hammer:
        a = -1.2 + hammer
        hx2, hy2 = sx + math.cos(a) * 26 * s * face, sy + math.sin(a) * 26 * s
        d.line([(sx, sy), (hx2, hy2)], fill=body, width=lw)
        tx, ty = hx2 + math.cos(a - 0.4) * 22 * s * face, hy2 + math.sin(a - 0.4) * 22 * s
        d.line([(hx2, hy2), (tx, ty)], fill=(120, 85, 55), width=max(2, int(4 * s)))
        d.rounded_rectangle([tx - 7 * s, ty - 6 * s, tx + 7 * s, ty + 6 * s], radius=int(2 * s), fill=(100, 100, 108))
    else:
        swing = math.sin(phase + math.pi) * 0.5 if walk else 0.25
        ax, ay = sx + (8 + 10 * swing) * s * face, sy + 22 * s
        if lamp or torch:
            ax, ay = sx + 18 * s * face, sy + 6 * s
        d.line([(sx, sy), (ax, ay)], fill=body, width=lw)
        if lamp or torch:
            fl = 1 + 0.12 * math.sin(t * 21 + x * 0.01)
            if lamp:
                d.rounded_rectangle([ax - 5 * s, ay - 2 * s, ax + 5 * s, ay + 12 * s], radius=int(2 * s), fill=(90, 70, 40))
            else:
                d.line([(ax, ay), (ax, ay - 18 * s)], fill=(100, 70, 40), width=max(2, int(4 * s)))
                ay -= 18 * s
            out = (ax, ay + (4 * s if lamp else 0), (7 if lamp else 11) * s * fl, (75 if lamp else 95) * s * fl,
                   C["glow"] if lamp else (255, 150, 50))
    # back arm
    d.line([(x - 4 * s * face, sy), (x - 9 * s * face, sy + 20 * s)], fill=tuple(int(c * 0.85) for c in body), width=lw)
    return out


def bubble(d, x, y, text, s=1.0):
    f = font(int(36 * s), 800)
    tw = d.textlength(text, font=f)
    w, h = tw + 36 * s, 62 * s
    bx, by = x - w / 2, y - h - 22 * s
    d.rounded_rectangle([bx, by, bx + w, by + h], radius=int(22 * s), fill=(255, 255, 255), outline=(30, 25, 20), width=max(2, int(3 * s)))
    d.polygon([(x - 10 * s, by + h - 2), (x + 8 * s, by + h - 2), (x - 6 * s, by + h + 18 * s)], fill=(255, 255, 255))
    d.text((x, by + h / 2), text, font=f, fill=(30, 25, 20), anchor="mm")


def goat(d, x, y, s, phase, face=1):
    BASE.goat(d, x, y, s, phase)


# ---------------- glow / particles ----------------
def apply_lights(fr, lights, dark=0.0):
    if dark > 0:
        sh = Image.new("RGBA", fr.size, (10, 6, 4, int(255 * dark)))
        if lights:
            m = Image.new("L", fr.size, 0); md = ImageDraw.Draw(m)
            for (x, y, r, g, col) in lights:
                md.ellipse([x - g * 1.6, y - g * 1.6, x + g * 1.6, y + g * 1.6], fill=255)
            m = m.filter(ImageFilter.GaussianBlur(60))
            alpha = Image.eval(m, lambda v: int((255 - v) * dark))
            sh.putalpha(alpha)
        fr.paste(sh, (0, 0), sh)
    lay = BASE.glow_layer(fr.size, lights)
    if lay: fr.paste(lay, (0, 0), lay)


def dust(d, t, n=40, col=(255, 230, 190)):
    rng = np.random.default_rng(3)
    for k in range(n):
        x = (rng.uniform(0, W) + t * rng.uniform(6, 20)) % W
        y = (rng.uniform(0, H) - t * rng.uniform(4, 14)) % H
        r = rng.uniform(1.5, 3.5)
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)


# ---------------- shots ----------------
def world_view(cx, cy, z):
    z = max(z, W / BASE.WW + 1e-3)
    vw, vh = W / z, H / z
    x0 = min(max(cx - vw / 2, 0), BASE.WW - vw); y0 = min(max(cy - vh / 2, 0), BASE.WH - vh)
    fr = WORLD.resize((W, H), Image.BILINEAR, box=(x0 * SS, y0 * SS, (x0 + vw) * SS, (y0 + vh) * SS))
    return fr, (lambda X, Y: ((X - x0) * z, (Y - y0) * z)), z


def draw_wall(d, T, s, state):
    wx, wy = T(1050, GY + 20)
    if state == "intact" or state == "crack":
        d.rectangle([wx, wy, wx + 40 * s, wy + 240 * s], fill=C["stone"])
        for k in range(1, 6):
            d.line([(wx, wy + k * 40 * s), (wx + 40 * s, wy + k * 40 * s)], fill=C["stone2"], width=max(1, int(3 * s)))
        if state == "crack":
            d.line([(wx + 22 * s, wy + 120 * s), (wx + 8 * s, wy + 170 * s), (wx + 26 * s, wy + 205 * s)], fill=(50, 40, 32), width=max(2, int(4 * s)))
    else:
        d.rectangle([wx, wy, wx + 40 * s, wy + 150 * s], fill=C["stone"])
        for k in range(1, 4):
            d.line([(wx, wy + k * 40 * s), (wx + 40 * s, wy + k * 40 * s)], fill=C["stone2"], width=max(1, int(3 * s)))
        for k in range(6):
            rx, ry = T(1030 + k * 12, GY + 258)
            d.ellipse([rx - 9 * s, ry - 12 * s, rx + 9 * s, ry], fill=C["stone2"])


def shot_world(sh, t, lt, dur):
    k = ease(lt / max(dur, 0.01)) if sh.get("ease", True) else lt / dur
    (a, b) = sh["cam"]
    cx, cy = lerp(a[0], b[0], k), lerp(a[1], b[1], k)
    z = math.exp(lerp(math.log(a[2]), math.log(b[2]), k))
    shake = sh.get("shake")
    if shake:
        for ht in shake:
            q = lt - ht
            if 0 <= q < 0.25:
                amp = (1 - q / 0.25) * 18 / z
                cx += math.sin(q * 90) * amp; cy += math.cos(q * 77) * amp
    fr, T, s = world_view(cx, cy, z)
    d = ImageDraw.Draw(fr)
    lights = []
    draw_wall(d, T, s, sh.get("wall", "open"))
    # room lamps + goats + fires everywhere
    for i, y in enumerate(LEVY):
        for lx in (LX0 + 300, LX1 - 300):
            X, Y = T(lx, y - 120)
            if -200 < Y < H + 200:
                d.ellipse([X - 5 * s, Y - 5 * s, X + 5 * s, Y + 5 * s], fill=C["glow"])
                lights.append((X, Y, 5 * s, 60 * s, C["glow"]))
        if i == 0:
            for kk, gx in enumerate((880, 990, 1120, 1240)):
                X, Y = T(gx, y)
                if -100 < Y < H + 100: goat(d, X, Y, s, t * 3 + kk)
        if i == 1:
            for fx in (900, 1200):
                X, Y = T(fx, y - 22)
                if -100 < Y < H + 100: lights.append((X, Y, 12 * s, 80 * s, C["fire"]))
    for fn in sh.get("draw", []):
        r = fn(d, T, s, t, lt, dur)
        if r: lights.extend(r)
    apply_lights(fr, lights, sh.get("dark", 0.0))
    d = ImageDraw.Draw(fr)
    if sh.get("dust"): dust(d, t, 35)
    for fn in sh.get("over", []):
        fn(d, T, s, t, lt, dur)
    return fr


@functools.lru_cache(maxsize=12)
def load_photo(p):
    im = Image.open(p).convert("RGB")
    w, h = im.size; sc = max(W * 1.15 / w, H * 1.15 / h)
    im = im.resize((int(w * sc), int(h * sc)), Image.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.12); im = ImageEnhance.Color(im).enhance(1.1)
    return im


def shot_photo(sh, t, lt, dur):
    im = load_photo(os.path.join(P, "real", sh["img"] + ".jpg"))
    k = lt / max(dur, 0.01)
    z = 1.0 + (0.12 * k if sh.get("move", "in") == "in" else 0.12 * (1 - k))
    w, h = im.size
    vw, vh = W / z, H / z
    fx, fy = sh.get("focus", (0.5, 0.5))
    cx, cy = fx * w, fy * h
    x0 = min(max(cx - vw / 2, 0), w - vw); y0 = min(max(cy - vh / 2, 0), h - vh)
    fr = im.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + vw, y0 + vh))
    d = ImageDraw.Draw(fr)
    if sh.get("label"):
        f = font(34, 800)
        txt = sh["label"]; tw = d.textlength(txt, font=f)
        d.rounded_rectangle([W / 2 - tw / 2 - 22, 1560, W / 2 + tw / 2 + 22, 1620], radius=14, fill=(255, 178, 72))
        d.text((W / 2, 1590), txt, font=f, fill=(25, 18, 10), anchor="mm")
    cr = json.load(open(os.path.join(P, "real", sh["img"] + ".credit.txt")))
    au = " ".join(cr["author"].replace("(talk)", "").split())[:38]
    d.text((W - 30, H - 40), f"REAL PHOTO · {au} · {cr['license']}", font=font(20, 500), fill=(235, 235, 235), anchor="rs")
    return fr


def render(t):
    sh = None
    for s_ in SHOTS:
        if s_["t0"] <= t < s_["t1"]: sh = s_
    if sh is None: sh = SHOTS[-1]
    lt, dur = t - sh["t0"], sh["t1"] - sh["t0"]
    fr = shot_world(sh, t, lt, dur) if sh["type"] == "world" else shot_photo(sh, t, lt, dur)
    # transition in
    tr = sh.get("tr", "punch")
    if tr == "punch" and lt < 0.22:
        zz = 1.07 - 0.07 * ease(lt / 0.22)
        w2, h2 = int(W * zz), int(H * zz)
        fr = fr.resize((w2, h2), Image.BILINEAR).crop(((w2 - W) // 2, (h2 - H) // 2, (w2 - W) // 2 + W, (h2 - H) // 2 + H))
    if tr == "flash" and lt < 0.3:
        fl = Image.new("RGB", (W, H), (255, 250, 240))
        fr = Image.blend(fr, fl, (1 - lt / 0.3) * 0.85)
    if tr == "whip" and lt < 0.18:
        fr = fr.filter(ImageFilter.BoxBlur(int(30 * (1 - lt / 0.18)) + 1))
    # vignette
    fr = Image.composite(fr, Image.new("RGB", (W, H), (0, 0, 0)), VIG)
    words(fr, t)
    return fr


VIG = None


def make_vig():
    y, x = np.ogrid[:H, :W]
    r = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    m = (1 - 0.38 * np.clip(r - 0.6, 0, 1) ** 1.4) * 255
    return Image.fromarray(m.astype(np.uint8), "L")


KEY = {"city", "lost", "eight", "levels", "eighty", "five", "meters", "twenty", "thousand", "hide", "silence",
       "inside", "door", "raiders", "cold", "wall", "down"}


def words(fr, t):
    d = ImageDraw.Draw(fr)
    for a, b, w in WORDS:
        if a <= t < b:
            w2 = w.strip(".,?!")
            col = (255, 205, 60) if w2.lower() in KEY else (255, 255, 255)
            pop = 1 + 0.12 * max(0, 1 - (t - a) / 0.12)
            d.text((W / 2, 300), w2, font=font(int(98 * pop), 900), fill=col, anchor="mm", stroke_width=11, stroke_fill=(18, 12, 8))
            break


# ---------------- story ----------------
def build(LT, WT):
    """LT: [(a,b)] per line; WT: per line list of (start,end,word)."""
    S = []
    def add(t0, t1, **kw):
        kw.update(t0=t0, t1=t1); S.append(kw)
    M = dict(body=(132, 92, 62), cap=(70, 58, 52), mustache=True)

    def man_at(x, y, **kw):
        def f(d, T, s, t, lt, dur):
            X, Y = T(x, y)
            o = char(d, X, Y, s * 1.5, t=t, **{**M, **kw})
            return [o] if o else []
        return f

    def man_path(u0, u1, **kw):
        def f(d, T, s, t, lt, dur):
            u = lerp(u0, u1, ease(lt / dur))
            x, y, fc = path_at(u)
            X, Y = T(x, y)
            o = char(d, X, Y, s * 1.5, face=fc, walk=True, phase=lt * 9, t=t, **{**M, **kw})
            return [o] if o else []
        return f

    a0, b0 = LT[0]; a1, b1 = LT[1]
    hits = [0.25, 0.75, 1.25, 1.7]
    def hammer_man(d, T, s, t, lt, dur):
        h = 0.0
        for ht in hits:
            q = lt - ht
            if -0.25 < q < 0.15: h = 1.6 * (1 - abs(q + 0.05) / 0.25)
        X, Y = T(1010, GY + 260)
        char(d, X, Y, s * 1.5, hammer=max(h, 0.01), brow=1, t=t, **M)
    def debris(d, T, s, t, lt, dur):
        for ht in hits:
            q = lt - ht
            if 0 < q < 0.5:
                for k in range(6):
                    X, Y = T(1045 - q * 160 * (0.4 + k * 0.15), GY + 150 + k * 10 + q * q * 400)
                    d.ellipse([X - 4 * s, Y - 4 * s, X + 4 * s, Y + 4 * s], fill=C["stone2"])
    # 0: hammering (cold open)
    add(a0, b0 + 0.15, type="world", cam=((1000, 1060, 2.6), (1010, 1070, 2.9)), wall="crack", tr=None,
        shake=hits, draw=[hammer_man], over=[debris], dark=0.25)
    # 1: flash -> real tunnel photo
    add(b0 + 0.15, b1 + 0.2, type="photo", img="p32", label="DERINKUYU, TURKEY · 1963", tr="flash", move="in")
    a2, b2 = LT[2]
    def air(d, T, s, t, lt, dur):
        for k in range(18):
            ph = (lt * 220 + k * 41) % 320
            X, Y = T(1090 - ph * 0.9, GY + 150 + (k % 6) * 18)
            d.line([(X, Y), (X + 34 * s, Y)], fill=(225, 238, 252), width=max(1, int(3 * s)))
    def man_hm(d, T, s, t, lt, dur):
        X, Y = T(1000, GY + 260)
        char(d, X, Y, s * 1.5, brow=-1, t=t, **M)
        if lt > 0.4: bubble(d, X, Y - 120 * s, "Cold air?!", s * 0.9)
    add(b1 + 0.2, b2 + 0.2, type="world", cam=((1040, 1080, 2.4), (1060, 1090, 2.6)), wall="open", draw=[man_hm], over=[air], dark=0.3)
    a3, b3 = LT[3]
    add(b2 + 0.2, b3 + 0.2, type="world", cam=((1080, 1100, 2.0), (1330, 1110, 2.0)), wall="open",
        draw=[man_path(SEG[1] + 10, SEG[3], lamp=True, crouch=True)], dark=0.45, tr="whip")
    a4, b4 = LT[4]
    w4 = WT[4]
    mid = w4[min(4, len(w4) - 1)][0] if w4 else (a4 + b4) / 2
    add(b3 + 0.2, mid, type="world", cam=((1400, 1150, 1.6), (1300, LEVY[0] - 150, 1.5)), wall="open",
        draw=[man_path(SEG[3], SEG[5] - 300, lamp=True)], dark=0.45, dust=True)
    add(mid, mid + 0.9, type="photo", img="p40", tr="punch", move="in", label="REAL STAIRS")
    add(mid + 0.9, b4 + 0.2, type="world", cam=((LX0 + 200, LEVY[0] + 100, 1.4), (LX0 + 300, LEVY[1] - 100, 1.4)), wall="open",
        draw=[man_path(SEG[5] - 300, SEG[7] - 400, lamp=True)], dark=0.45, dust=True, tr="whip")
    a5, b5 = LT[5]
    w5 = WT[5]
    ts5 = [w[0] for w in w5] if len(w5) >= 3 else [a5, a5 + 0.8, a5 + 1.6]
    add(b4 + 0.2, ts5[1], type="photo", img="p04", label="INSIDE DERINKUYU", tr="punch")
    add(ts5[1], ts5[2], type="photo", img="p11", label="INSIDE DERINKUYU", tr="punch")
    add(ts5[2], b5 + 0.25, type="photo", img="p12", label="WELLS", tr="punch")
    a6, b6 = LT[6]
    def ruler(d, T, s, t, lt, dur):
        X0, Y0 = T(LX0 - 80, GY); X1, Y1 = T(LX0 - 80, LEVY[-1])
        yy = Y0 + (Y1 - Y0) * ease(lt / dur)
        d.line([(X0, Y0), (X0, yy)], fill=(255, 205, 60), width=6)
        d.text((X0 - 14, yy), f"{int(85 * ease(lt / dur))} m", font=font(54, 900), fill=(255, 205, 60), anchor="rm", stroke_width=6, stroke_fill=(0, 0, 0))
    add(b5 + 0.25, b6 + 0.2, type="world", cam=((1080, 1600, 1.0), (1080, 2650, 0.5)), wall="open", over=[ruler], tr="whip", ease=True)
    a7, b7 = LT[7]
    def crowd(d, T, s, t, lt, dur):
        n = int(min(1, lt / (dur * 0.8)) * 320)
        rng = np.random.default_rng(1)
        for kk in range(n):
            lv = kk % 8; px = rng.uniform(LX0 + 60, LX1 - 60)
            X, Y = T(px, LEVY[lv] - 2)
            col = [(200, 80, 70), (80, 120, 180), (210, 170, 70), (90, 150, 100)][kk % 4]
            d.rounded_rectangle([X - 4, Y - 12, X + 4, Y], radius=2, fill=col)
            d.ellipse([X - 4, Y - 19, X + 4, Y - 11], fill=(236, 196, 158))
    def count(d, T, s, t, lt, dur):
        c = int(min(1, lt / (dur * 0.8)) * 20000)
        d.text((W / 2, 1500), f"{c:,}", font=font(150, 900), fill=(255, 205, 60), anchor="mm", stroke_width=12, stroke_fill=(0, 0, 0))
        d.text((W / 2, 1620), "PEOPLE", font=font(56, 900), fill=(255, 255, 255), anchor="mm", stroke_width=7, stroke_fill=(0, 0, 0))
    add(b6 + 0.2, b7 + 0.2, type="world", cam=((1080, 2650, 0.5), (1080, 2600, 0.55)), wall="open", draw=[crowd], over=[count], tr=None)
    a8, b8 = LT[8]
    midd = (a8 + b8) / 2
    add(b7 + 0.2, midd, type="photo", img="p58", label="REAL STONE DOOR", tr="punch", move="in")
    def door(d, T, s, t, lt, dur):
        p = ease((lt - 0.2) / max(dur - 0.6, 0.3))
        dx = LX0 + 260 - 140 * p
        X, Y = T(dx, LEVY[4] - 58)
        r = 56 * s
        d.ellipse([X - r, Y - r, X + r, Y + r], fill=C["stone"], outline=C["stone2"], width=max(2, int(5 * s)))
        ang = -p * 2.6
        hx, hy = X + math.cos(ang) * 22 * s, Y + math.sin(ang) * 22 * s
        d.ellipse([hx - 12 * s, hy - 12 * s, hx + 12 * s, hy + 12 * s], fill=C["stone2"])
        PX, PY = T(dx + 80, LEVY[4])
        o = char(d, PX, PY, s * 1.3, (90, 110, 150), face=-1, brow=1, t=t, lamp=False)
        PX2, PY2 = T(dx + 140, LEVY[4])
        char(d, PX2, PY2, s * 1.1, (170, 80, 70), face=-1, hair=(60, 40, 30), t=t)
        return []
    def rumble(d, T, s, t, lt, dur): pass
    add(midd, b8 + 0.2, type="world", cam=((LX0 + 200, LEVY[4] - 80, 2.3), (LX0 + 180, LEVY[4] - 80, 2.5)), wall="open",
        draw=[door], dark=0.35, dust=True, shake=[0.3, 0.9], tr="whip")
    a9, b9 = LT[9]
    def families(d, T, s, t, lt, dur):
        out = []
        cols = [(170, 80, 70), (80, 110, 160), (200, 160, 70), (90, 140, 100), (150, 90, 140)]
        for kk in range(7):
            u = (lt * 70 + kk * 120) % (SEG[7] - SEG[3]) + SEG[3]
            x, y, fc = path_at(u)
            X, Y = T(x, y)
            o = char(d, X, Y, s * 1.3, cols[kk % 5], face=fc, walk=True, phase=t * 9 + kk, lamp=(kk % 3 == 0),
                     hair=(50, 35, 25) if kk % 2 else None, kid=(kk % 4 == 3), t=t)
            if o: out.append(o)
        X, Y = path_at(SEG[3] + 120 + lt * 70)[:2]
        X, Y = T(X, Y)
        if lt > 0.3: bubble(d, X, Y - 110 * s, "Hurry!", s * 0.8)
        return out
    add(b8 + 0.2, b9 + 0.2, type="world", cam=((1350, 1250, 1.3), (1150, LEVY[0] + 200, 1.3)), wall="open", draw=[families], dark=0.4)
    a10, b10 = LT[10]
    def raiders(d, T, s, t, lt, dur):
        out = []
        for kk in range(5):
            x = min(200 + lt * 160 + kk * 90, 760 + kk * 80)
            X, Y = T(x, GY)
            o = char(d, X, Y, s * 1.4, (120, 40, 38), cap=(40, 28, 26), walk=x < 760 + kk * 80, phase=t * 9 + kk, torch=True, brow=1, t=t)
            if o: out.append(o)
        if lt > dur * 0.55:
            X, Y = T(1000, GY - 170)
            bubble(d, X, Y, "Where is everyone?", 1.0)
        X2, Y2 = T(LX1 - 300, LEVY[0])
        char(d, X2, Y2, s * 1.4, (90, 110, 150), face=-1, shh=True, t=t)
        return out
    add(b9 + 0.2, b10 + 0.2, type="world", cam=((700, 1080, 0.95), (900, 1150, 1.0)), wall="open", draw=[raiders], dark=0.55, tr="whip")
    a11, b11 = LT[11]
    m11 = (a11 + b11) / 2
    add(b10 + 0.2, m11, type="photo", img="p50", label="DERINKUYU TODAY", tr="flash", move="in")
    add(m11, b11 + 0.2, type="photo", img="p30", tr="punch", move="in")
    a12, b12 = LT[12]
    m12 = a12 + (b12 - a12) * 0.55
    def man_end(d, T, s, t, lt, dur):
        X, Y = T(980, GY + 260)
        char(d, X, Y, s * 1.5, brow=-1, t=t, **{**M, "body": (90, 110, 150), "cap": None, "mustache": False}, hair=(60, 40, 30))
        if lt > 0.3: bubble(d, X, Y - 120 * s, "...is that a draft?", s * 0.85)
    add(b11 + 0.2, m12, type="world", cam=((1020, 1070, 2.3), (1015, 1070, 2.45)), wall="crack", draw=[man_end], over=[air], dark=0.3, tr="punch")
    def man_loop(d, T, s, t, lt, dur):
        X, Y = T(1010, GY + 260)
        char(d, X, Y, s * 1.5, hammer=0.01, brow=1, t=t, **M)
    # final shot = exact first-frame framing (wall intact, hammer raised) -> seamless loop
    add(m12, b12 + 0.05, type="world", cam=((1000, 1060, 2.6), (1000, 1060, 2.6)), wall="crack", draw=[man_loop], dark=0.25, tr="whip")
    return S


# ---------------- audio: sfx ----------------
SR = 44100


def sfx_track(S, total):
    n = int(total * SR) + SR
    y = np.zeros(n, np.float32)
    rng = np.random.default_rng(0)
    def put(t, sig, g=1.0):
        a = int(t * SR); y[a:a + len(sig)] += (sig[:n - a] * g).astype(np.float32)
    def thud():
        tt = np.arange(int(0.35 * SR)) / SR
        return (np.sin(2 * np.pi * (70 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 14) + rng.standard_normal(len(tt)) * np.exp(-tt * 40) * 0.5) * 0.8
    def whoosh(d):
        tt = np.arange(int(d * SR)) / SR
        nz = rng.standard_normal(len(tt))
        from scipy.signal import butter, sosfilt
        nz = sosfilt(butter(2, [300, 2500], "band", fs=SR, output="sos"), nz)
        return nz * np.sin(np.pi * tt / d) ** 2 * 0.25
    def rumble(d):
        tt = np.arange(int(d * SR)) / SR
        from scipy.signal import butter, sosfilt
        nz = sosfilt(butter(2, 140, "low", fs=SR, output="sos"), rng.standard_normal(len(tt)))
        return nz / (np.abs(nz).max() + 1e-6) * np.sin(np.pi * tt / d) * 0.5
    def step():
        tt = np.arange(int(0.08 * SR)) / SR
        return rng.standard_normal(len(tt)) * np.exp(-tt * 60) * 0.15
    s0 = S[0]
    for ht in [0.25, 0.75, 1.25, 1.7]: put(s0["t0"] + ht, thud())
    for s_ in S:
        if s_.get("tr") in ("whip", "flash"): put(max(s_["t0"] - 0.1, 0), whoosh(0.35), 0.8)
        if s_.get("tr") == "punch": put(s_["t0"], whoosh(0.15), 0.4)
    for s_ in S:
        if s_.get("shake") and s_ is not s0:
            put(s_["t0"], rumble(s_["t1"] - s_["t0"]), 0.9)
    for s_ in S[3:5]:
        tt = s_["t0"]
        while tt < s_["t1"]:
            put(tt, step()); tt += 0.33
    return y


# ---------------- main ----------------
def init(p, shots, wd):
    global P, SHOTS, WORDS, WORLD, VIG
    P, SHOTS, WORDS = p, shots, wd
    WORLD = Image.open(os.path.join(P, "world.png")); WORLD.load()
    VIG = make_vig()


def frame(t): return render(t).tobytes()


def main(p):
    P_ = os.path.abspath(p)
    BASE.P = P_
    lines = [x[0] for x in json.load(open(os.path.join(P_, "lines_in.json")))]
    LT, cur = [], 0.15
    paths = []
    for i in range(len(lines)):
        ap = os.path.join(P_, "aud", f"line_{i:03d}.wav")
        dur = float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", ap], capture_output=True, text=True).stdout)
        LT.append((cur, cur + dur)); paths.append(ap)
        cur += dur + (0.15 if i == 0 else 0.35)
    total = LT[-1][1] + 0.05
    # word timings
    from faster_whisper import WhisperModel
    m = WhisperModel("small", device="cpu", compute_type="int8")
    WT, allw = [], []
    for (a, b), ap, text in zip(LT, paths, lines):
        raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", ap, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
        x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
        segs, _ = m.transcribe(x, language="en", word_timestamps=True)
        ws = [w for s_ in segs for w in s_.words]
        toks = text.replace("...", " ").split()
        lw = []
        if ws and len(ws) == len(toks):
            lw = [(a + w.start, a + w.end, tk) for w, tk in zip(ws, toks)]
        elif ws:
            t0, t1 = ws[0].start, ws[-1].end; tot = sum(len(k) + 2 for k in toks); acc = 0
            for tk in toks:
                s0 = t0 + (t1 - t0) * acc / tot; acc += len(tk) + 2
                lw.append((a + s0, a + t0 + (t1 - t0) * acc / tot, tk))
        WT.append(lw); allw += lw
    allw.sort()
    wd = [(a, max(b, min(allw[k + 1][0] if k + 1 < len(allw) else b + 0.3, a + 0.6)), w) for k, (a, b, w) in enumerate(allw)]
    S = build(LT, WT)
    S[-1]["t1"] = total
    S[0]["t0"] = 0.0
    os.makedirs(os.path.join(P_, "out"), exist_ok=True)
    sfx = sfx_track(S, total)
    sf.write(os.path.join(P_, "out", "sfx.wav"), sfx, SR)
    voice = [(a, pth) for (a, b), pth in zip(LT, paths)] + [(0.0, os.path.join(P_, "out", "sfx.wav"))]
    json.dump({"total": total, "voice": voice}, open(os.path.join(P_, "out", "timeline.json"), "w"))
    if not os.path.exists(os.path.join(P_, "world.png")):
        BASE.build_world().save(os.path.join(P_, "world.png"))
    # shots contain lambdas -> rebuild inside workers via fork (Pool with fork start method inherits globals)
    global SHOTS_G
    SHOTS_G = S
    lim = float(os.environ.get("LIMIT", total)); n = int(min(total, lim) * FPS)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", os.path.join(P_, "out", "video_noaudio.mp4")],
                           stdin=subprocess.PIPE)
    with Pool(4, initializer=init_fork, initargs=(P_, wd)) as pool:
        for b in pool.imap(frame, (i / FPS for i in range(n)), chunksize=6):
            enc.stdin.write(b)
    enc.stdin.close(); enc.wait()
    print("done", total)


SHOTS_G = None


def init_fork(p, wd):
    init(p, SHOTS_G, wd)


if __name__ == "__main__":
    main(sys.argv[1])
