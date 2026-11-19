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
import rig as RIG


def char(d, x, y, s, body, face=1, hair=None, cap=None, mustache=False, walk=False, phase=0.0, talk=False,
         lamp=False, torch=False, crouch=False, hammer=0.0, brow=0, shh=False, t=0.0, kid=False):
    """Adapter: old call signature -> rig v3, drawn 2x supersampled into a sprite and composited."""
    img = d._image
    if mustache: look = dict(RIG.LOOKS["farmer"]); look["vest"] = (118, 82, 54)
    elif torch: look = dict(RIG.LOOKS["raider"])
    elif hair and not kid and body[0] > 140: look = dict(RIG.LOOKS["woman"]); look["shirt"] = body
    elif kid: look = dict(RIG.LOOKS["boy"]); look["shirt"] = body
    elif hair: look = dict(RIG.LOOKS["modern"]); look["shirt"] = body; look["hair"] = hair
    else: look = dict(RIG.LOOKS["woman2"]) if body[2] > body[0] else dict(RIG.LOOKS["elder"]); look["shirt"] = body
    if cap is None and "cap" in look and not mustache and not torch: pass
    expr = "shh" if shh else ("talk" if talk else ("surprised" if brow < 0 else ("angry" if brow > 0 else "neutral")))
    prop = "hammer" if hammer else ("lamp" if lamp else ("torch" if torch else None))
    sc = s * 0.69
    SSF = 2
    bw, bh = int(170 * sc), int(190 * sc)
    if bw < 4 or x < -bw or x > img.size[0] + bw or y < -20 or y > img.size[1] + bh: return None
    lay = Image.new("RGBA", (bw * SSF, bh * SSF), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay, "RGBA")
    ox, oy = bw / 2, bh - 12 * sc
    pose = dict(face=face, walk=(phase if walk else None), expr=expr, prop=prop, t=t, kid=kid,
                crouch=0.6 if crouch else 0.0, hammer=min(1.0, hammer / 1.6) if hammer else 0.0)
    L = RIG.draw_char(ld, ox * SSF, oy * SSF, sc * SSF, look, pose)
    lay = volume(lay.resize((bw, bh), Image.LANCZOS), face)
    px, py = int(round(x - ox)), int(round(y - oy))
    img.paste(lay, (px, py), lay)
    if L:
        lx, ly, r, g, col = L[0]
        return (px + lx / SSF, py + ly / SSF, r / SSF, g / SSF, col)
    return None


def volume(lay, face, warm=(255, 214, 160)):
    """soft form shading + rim light on a character sprite (RGBA)"""
    w, h = lay.size
    if w < 8 or h < 8: return lay
    a = np.asarray(lay).astype(np.float32)
    alpha = a[..., 3:4] / 255.0
    xs = np.linspace(0, 1, w, dtype=np.float32)[None, :, None]
    if face < 0: xs = 1 - xs
    ys = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    shade = (0.80 + 0.22 * np.clip((xs - 0.25) / 0.6, 0, 1)) * (1.0 - 0.10 * np.clip((ys - 0.55) / 0.45, 0, 1))
    a[..., :3] *= shade
    # rim light on the facing side: alpha minus alpha shifted toward the light
    k = max(1, int(w * 0.012))
    sh = np.roll(alpha, -k * (1 if face > 0 else -1), axis=1)
    rim = np.clip(alpha - sh, 0, 1)
    a[..., :3] = a[..., :3] * (1 - rim * 0.55) + np.array(warm, np.float32) * rim * 0.55
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


def actor(d, X, Y, sc, look, pose):
    """draw a rig character (2x supersampled) at screen feet (X,Y) with rig scale sc"""
    img = d._image
    bw, bh = int(170 * sc), int(190 * sc)
    if bw < 4 or X < -bw or X > img.size[0] + bw or Y < -20 or Y > img.size[1] + bh: return []
    lay = Image.new("RGBA", (bw * 2, bh * 2), (0, 0, 0, 0)); ld = ImageDraw.Draw(lay, "RGBA")
    ox, oy = bw / 2, bh - 12 * sc
    L = RIG.draw_char(ld, ox * 2, oy * 2, sc * 2, look, pose)
    lay = volume(lay.resize((bw, bh), Image.LANCZOS), pose.get("face", 1))
    px, py = int(round(X - ox)), int(round(Y - oy))
    img.paste(lay, (px, py), lay)
    return [(px + lx / 2, py + ly / 2, r / 2, g / 2, col) for (lx, ly, r, g, col) in L]


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
    rays(fr, lights)


RAY_T = [0.0]


def rays(fr, lights):
    """soft volumetric rays around strong lights (lamps, torches, fires): thin wedges, blurred, additive-ish"""
    strong = [l for l in lights if l[3] > 40]
    if not strong: return
    lay = Image.new("RGBA", fr.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
    t = RAY_T[0]
    for (x, y, r, g, col) in strong[:10]:
        L = g * 2.4
        for k in range(6):
            a = k * (2 * math.pi / 6) + t * 0.15 + (x * 0.01)
            w = 0.07 + 0.03 * math.sin(t * 1.3 + k)
            p1 = (x + math.cos(a - w) * L, y + math.sin(a - w) * L)
            p2 = (x + math.cos(a + w) * L, y + math.sin(a + w) * L)
            ld.polygon([(x, y), p1, p2], fill=col + (12,))
    lay = lay.filter(ImageFilter.GaussianBlur(14))
    fr.paste(lay, (0, 0), lay)


def beam(fr, x0, y0, x1, y1, w0, w1, col=(255, 236, 190), alpha=90):
    """a light shaft from (x0,y0) widening to (x1,y1)"""
    lay = Image.new("RGBA", fr.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
    dx, dy = x1 - x0, y1 - y0; n = math.hypot(dx, dy) + 1e-6; px, py = -dy / n, dx / n
    for k in range(6):
        f = 1 - k / 6
        ld.polygon([(x0 + px * w0 * f, y0 + py * w0 * f), (x0 - px * w0 * f, y0 - py * w0 * f),
                    (x1 - px * w1 * f, y1 - py * w1 * f), (x1 + px * w1 * f, y1 + py * w1 * f)], fill=col + (int(alpha / 6),))
    lay = lay.filter(ImageFilter.GaussianBlur(20))
    fr.paste(lay, (0, 0), lay)


FG = None


def fg_shapes():
    """foreground rock anchors in world coords; shape outline is in screen px (fixed size)"""
    rng = np.random.default_rng(21)
    out = []
    for k in range(140):
        wx = rng.uniform(200, 2000); wy = rng.uniform(BASE.GY + 200, BASE.WH - 50)
        rr = rng.uniform(70, 150)
        offs = [(math.cos(j / 8 * 2 * math.pi) * rr * rng.uniform(0.6, 1.1),
                 math.sin(j / 8 * 2 * math.pi) * rr * rng.uniform(0.5, 0.9)) for j in range(8)]
        out.append((wx, wy, offs))
    return out


def foreground(fr, cx, cy, z):
    global FG
    if FG is None: FG = fg_shapes()
    if cy + (H / z) / 2 < BASE.GY + 60: return
    lay = Image.new("RGBA", fr.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
    pz = z * 1.8
    drawn = 0
    for wx, wy, offs in FG:
        X = (wx - cx) * pz + W / 2; Y = (wy - cy) * pz + H / 2
        if not (-40 < Y < H + 40): continue
        if not (X < 50 or X > W - 50): continue
        if X < -120 or X > W + 120: continue
        if wy < BASE.GY + 150: continue
        ld.polygon([(X + ox * 0.8, Y + oy * 0.8) for ox, oy in offs], fill=(20, 14, 10, 175)); drawn += 1
        if drawn >= 2: break
    if drawn:
        lay = lay.filter(ImageFilter.GaussianBlur(6))
        fr.paste(lay, (0, 0), lay)


def grade(fr, kind):
    if not kind: return fr
    a = np.asarray(fr, np.float32)
    if kind == "cold": a *= np.array([0.86, 0.94, 1.12], np.float32)
    elif kind == "warm": a *= np.array([1.08, 1.0, 0.86], np.float32)
    elif kind == "night": a = a * np.array([0.72, 0.8, 1.0], np.float32)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


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
        d.rectangle([wx, wy, wx + 40 * s, wy + 115 * s], fill=C["stone"])
        for k in range(1, 3):
            d.line([(wx, wy + k * 40 * s), (wx + 40 * s, wy + k * 40 * s)], fill=C["stone2"], width=max(1, int(3 * s)))
        for k in range(6):
            rx, ry = T(1030 + k * 12, GY + 258)
            d.ellipse([rx - 9 * s, ry - 12 * s, rx + 9 * s, ry], fill=C["stone2"])


def shot_world(sh, t, lt, dur):
    k = ease(lt / max(dur, 0.01)) if sh.get("ease", True) else lt / dur
    (a, b) = sh["cam"]
    cx, cy = lerp(a[0], b[0], k), lerp(a[1], b[1], k)
    z = math.exp(lerp(math.log(a[2]), math.log(b[2]), k))
    if sh.get("follow"):
        u0, u1, zf = sh["follow"]
        fx, fy, _ = path_at(lerp(u0, u1, ease(lt / max(dur, 0.01))))
        cx, cy, z = fx, fy - 70, zf
    shake = sh.get("shake")
    if shake:
        for ht in shake:
            q = lt - ht
            if 0 <= q < 0.25:
                amp = (1 - q / 0.25) * 18 / z
                cx += math.sin(q * 90) * amp; cy += math.cos(q * 77) * amp
    RAY_T[0] = t
    fr, T, s = world_view(cx, cy, z)
    if z >= 5.0:
        fr = fr.filter(ImageFilter.GaussianBlur(min(4.5, 0.4 + z * 0.15)))
    d = ImageDraw.Draw(fr, "RGBA")
    lights = []
    draw_wall(d, T, s, sh.get("wall", "open"))
    # room lamps + goats + fires everywhere
    for i, y in enumerate(LEVY):
        for lx in (LX0 + 300, LX1 - 300):
            X, Y = T(lx, y - 120)
            if -200 < Y < H + 200:
                d.ellipse([X - 5 * s, Y - 5 * s, X + 5 * s, Y + 5 * s], fill=C["glow"])
                lights.append((X, Y, 5 * s, 34 * s, C["glow"]))
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
    apply_lights(fr, lights, sh.get("dark", 0.0) * 0.55)
    if sh.get("beam"):
        bx, by = T(1072, BASE.GY + 200)
        flick = 1 + 0.08 * math.sin(t * 9)
        beam(fr, bx, by, bx - 520 * s, by + 120 * s, 40 * s, 170 * s, alpha=int(110 * flick))
    foreground(fr, cx, cy, z)
    fr = grade(fr, sh.get("grade"))
    d = ImageDraw.Draw(fr, "RGBA")
    if sh.get("dust"): dust(d, t, 45)
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
    d = ImageDraw.Draw(fr, "RGBA")
    for (ax, ay, bx2, by2, txt) in sh.get("callouts", []):
        a_ = ease((lt - 0.35) / 0.4)
        if a_ > 0:
            X0, Y0, X1, Y1 = ax * W, ay * H, bx2 * W, by2 * H
            Xm, Ym = X0 + (X1 - X0) * a_, Y0 + (Y1 - Y0) * a_
            d.line([(X0, Y0), (Xm, Ym)], fill=(255, 205, 60), width=8)
            ang = math.atan2(Ym - Y0, Xm - X0)
            for sg in (2.6, -2.6):
                d.line([(Xm, Ym), (Xm + math.cos(ang + sg) * 40, Ym + math.sin(ang + sg) * 40)], fill=(255, 205, 60), width=8)
            f_ = font(46, 900)
            d.text((X0, Y0 - 34), txt, font=f_, fill=(255, 255, 255), anchor="mm", stroke_width=8, stroke_fill=(0, 0, 0))
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
    if tr == "reveal" and lt < 0.5:
        prev = None
        for s_ in SHOTS:
            if abs(s_["t1"] - sh["t0"]) < 1e-6 or (s_["t0"] < sh["t0"] and s_["t1"] >= sh["t0"] - 1e-6 and s_ is not sh): prev = s_
        if prev is not None:
            pd = prev["t1"] - prev["t0"]
            pf = shot_world(prev, t, pd - 0.01, pd) if prev["type"] == "world" else shot_photo(prev, t, pd - 0.01, pd)
            k = ease(lt / 0.5)
            m = Image.new("L", (W, H), 0); md = ImageDraw.Draw(m)
            edge = -400 + (W + H + 800) * k
            md.polygon([(0, 0), (edge, 0), (edge - H * 0.6, H), (0, H)], fill=255)
            m = m.filter(ImageFilter.GaussianBlur(18))
            glow = Image.new("L", (W, H), 0); gd = ImageDraw.Draw(glow)
            gd.line([(edge, 0), (edge - H * 0.6, H)], fill=255, width=26)
            glow = glow.filter(ImageFilter.GaussianBlur(22))
            fr = Image.composite(fr, pf, m)
            fr.paste(Image.new("RGB", (W, H), (255, 225, 160)), (0, 0), glow)
    if tr == "whip" and lt < 0.18:
        fr = fr.filter(ImageFilter.BoxBlur(int(30 * (1 - lt / 0.18)) + 1))
    # vignette
    fr = Image.composite(fr, Image.new("RGB", (W, H), (0, 0, 0)), VIG)
    a = np.asarray(fr, np.int16)
    g = GRAIN[(int(t * 24) * 7) % 16]
    a = np.clip(a + g[..., None], 0, 255).astype(np.uint8)
    fr = Image.fromarray(a)
    words(fr, t)
    return fr


VIG = None
GRAIN = None


def make_vig():
    y, x = np.ogrid[:H, :W]
    r = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    m = (1 - 0.22 * np.clip(r - 0.65, 0, 1) ** 1.4) * 255
    return Image.fromarray(m.astype(np.uint8), "L")


KEY = {"city", "lost", "eight", "levels", "eighty", "five", "meters", "twenty", "thousand", "hide", "silence",
       "inside", "door", "raiders", "cold", "wall", "down"}


def words(fr, t):
    d = ImageDraw.Draw(fr, "RGBA")
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
            o = char(d, X, Y, s * 1.5, face=fc, walk=True, phase=(u - u0) * math.pi / 28.8, t=t, **{**M, **kw})
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
    add(b1 + 0.2, b2 + 0.2, type="world", cam=((1040, 1080, 2.4), (1060, 1090, 2.6)), wall="open", draw=[man_hm], over=[air], dark=0.35, beam=True, grade="cold")
    a3, b3 = LT[3]
    add(b2 + 0.2, b3 + 0.2, type="world", cam=((1080, 1100, 2.0), (1330, 1110, 2.0)), wall="open",
        draw=[man_path(SEG[1] + 10, SEG[3], lamp=True, crouch=True)], dark=0.45, tr="whip", follow=(SEG[1] + 10, SEG[3], 2.7))
    a4, b4 = LT[4]
    w4 = WT[4]
    mid = w4[min(4, len(w4) - 1)][0] if w4 else (a4 + b4) / 2
    add(b3 + 0.2, mid, type="world", cam=((1400, 1150, 1.6), (1300, LEVY[0] - 150, 1.5)), wall="open",
        draw=[man_path(SEG[3], SEG[5] - 300, lamp=True)], dark=0.45, dust=True, follow=(SEG[3], SEG[5] - 300, 2.2))
    add(mid, mid + 0.9, type="photo", img="p40", tr="reveal", move="in", label="THE REAL STAIRS")
    add(mid + 0.9, b4 + 0.2, type="world", cam=((LX0 + 200, LEVY[0] + 100, 1.4), (LX0 + 300, LEVY[1] - 100, 1.4)), wall="open",
        draw=[man_path(SEG[5] - 300, SEG[7] - 400, lamp=True)], dark=0.45, dust=True, tr="whip", follow=(SEG[5] - 300, SEG[7] - 400, 2.2))
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
    add(b7 + 0.2, midd + 0.4, type="world", cam=((LX0 + 200, LEVY[4] - 80, 2.3), (LX0 + 180, LEVY[4] - 80, 2.5)), wall="open",
        draw=[door], dark=0.35, dust=True, shake=[0.3, 0.9], tr="punch")
    add(midd + 0.4, b8 + 0.2, type="photo", img="p58", label="THE REAL STONE DOOR", tr="reveal", move="in", callouts=[(0.32, 0.22, 0.45, 0.42, "ROLLED FROM INSIDE")])
    a9, b9 = LT[9]
    def families(d, T, s, t, lt, dur):
        out = []
        cols = [(170, 80, 70), (80, 110, 160), (200, 160, 70), (90, 140, 100), (150, 90, 140)]
        for kk in range(7):
            u = (lt * 70 + kk * 120) % (SEG[7] - SEG[3]) + SEG[3]
            x, y, fc = path_at(u)
            X, Y = T(x, y)
            o = char(d, X, Y, s * 1.3, cols[kk % 5], face=fc, walk=True, phase=(lt * 70 + kk * 120) * math.pi / 25.0, lamp=(kk % 3 == 0),
                     hair=(50, 35, 25) if kk % 2 else None, kid=(kk % 4 == 3), t=t)
            if o: out.append(o)
        X, Y = path_at(SEG[3] + 120 + lt * 70)[:2]
        X, Y = T(X, Y)
        if lt > 0.3: bubble(d, X, Y - 110 * s, "Hurry!", s * 0.8)
        return out
    m9 = b8 + 0.2 + (b9 - b8) * 0.5
    add(b8 + 0.2, m9, type="world", cam=((1350, 1250, 1.7), (1150, LEVY[0] + 150, 1.7)), wall="open", draw=[families], dark=0.4)
    MOM = dict(RIG.LOOKS["woman"]); GIRL = dict(RIG.LOOKS["boy"]); GIRL["shirt"] = (200, 150, 70); GIRL["hair"] = (70, 46, 30)
    DAD = dict(RIG.LOOKS["farmer"]); RAID = dict(RIG.LOOKS["raider"])
    HX, HY = LX0 + 520, LEVY[2]
    def hide_room(d, T, s, t, lt, dur):
        out = []
        X, Y = T(HX, HY)
        out += actor(d, X - 26 * s, Y, s * 0.95, MOM, dict(face=1, gesture="hug", expr="scared", t=t, fx=("tears",)))
        out += actor(d, X + 10 * s, Y, s * 0.95, GIRL, dict(face=-1, kid=True, expr="scared", gesture="cower", tremble=True, t=t))
        LX, LY = T(HX - 70, HY - 105)
        out.append((LX, LY, 5 * s, 70 * s, C["glow"]))
        return out
    add(m9, b9 + 0.2, type="world", cam=((HX - 5, HY - 52, 6.2), (HX - 5, HY - 54, 7.0)), wall="open", draw=[hide_room], dark=0.5, tr="punch")
    a10, b10 = LT[10]
    q = (b10 + 0.2 - (b9 + 0.2)) / 4
    t10 = [b9 + 0.2 + q * k for k in range(5)]
    def raiders(d, T, s, t, lt, dur):
        out = []
        for kk in range(5):
            x = min(200 + lt * 160 + kk * 90, 760 + kk * 80)
            X, Y = T(x, GY)
            stop = x >= 760 + kk * 80
            out += actor(d, X, Y, s * 1.0, RAID, dict(face=1, walk=None if stop else x * math.pi / 27.0, prop="torch" if kk != 4 else None,
                                                    gesture="point" if (kk == 4 and stop) else None, expr="angry", t=t))
        return out
    add(t10[0], t10[1], type="world", cam=((760, 1040, 1.3), (880, 1060, 1.4)), wall="open", draw=[raiders], dark=0.6, tr="whip", grade="night")
    def dad_door(d, T, s, t, lt, dur):
        out = []
        X, Y = T(LX0 + 205, LEVY[4] - 58)
        r = 56 * s
        d.ellipse([X - r, Y - r, X + r, Y + r], fill=C["stone"], outline=C["stone2"], width=max(2, int(5 * s)))
        d.ellipse([X - 12 * s, Y - 12 * s, X + 12 * s, Y + 12 * s], fill=C["stone2"])
        PX, PY = T(LX0 + 290, LEVY[4])
        out += actor(d, PX, PY, s * 0.95, DAD, dict(face=-1, gesture="push", expr="angry", fx=("sweat",), t=t, tremble=True))
        return out
    add(t10[1], t10[2], type="world", cam=((LX0 + 245, LEVY[4] - 60, 4.6), (LX0 + 250, LEVY[4] - 62, 5.2)), wall="open", draw=[dad_door], dark=0.5, tr="punch")
    def girl_close(d, T, s, t, lt, dur):
        out = []
        X, Y = T(HX + 10, HY)
        out += actor(d, X, Y, s * 0.95, GIRL, dict(face=-1, kid=True, expr="scared", t=t, tremble=True, fx=("sweat",)))
        # torch light sweeping above (through the ceiling cracks)
        sw = (lt / max(dur, 0.1))
        LX, LY = T(HX - 120 + sw * 260, HY - 150)
        out.append((LX, LY, 4 * s, 90 * s, (255, 150, 60)))
        return out
    add(t10[2], t10[3], type="world", cam=((HX + 13, HY - 64, 24.0), (HX + 13, HY - 64, 27.0)), wall="open", draw=[girl_close], dark=0.65, tr="punch", grade="night")
    def raider_q(d, T, s, t, lt, dur):
        out = []
        X, Y = T(940, GY)
        out += actor(d, X, Y, s * 1.0, RAID, dict(face=1, prop="torch", expr="surprised", t=t))
        if lt > 0.3: bubble(d, X + 20 * s, Y - 120 * s, "...where is everyone?", s * 0.85)
        return out
    add(t10[3], b10 + 0.2, type="world", cam=((960, 820, 2.4), (970, 815, 2.6)), wall="open", draw=[raider_q], dark=0.45, tr="punch", grade="night")
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
    def riser(d):
        tt = np.arange(int(d * SR)) / SR
        from scipy.signal import butter, sosfilt
        nz = rng.standard_normal(len(tt))
        out = np.zeros_like(nz)
        for k in range(8):
            a, b = int(k * len(tt) / 8), int((k + 1) * len(tt) / 8)
            f = 400 + 3000 * (k / 8)
            out[a:b] = sosfilt(butter(2, [f, f * 1.6], "band", fs=SR, output="sos"), nz[a:b])
        return out * (tt / d) ** 2 * 0.35
    def boom():
        tt = np.arange(int(1.2 * SR)) / SR
        return np.sin(2 * np.pi * (48 + 30 * np.exp(-tt * 8)) * tt) * np.exp(-tt * 3.5) * 0.9
    def crackle(d):
        n_ = int(d * SR); y_ = np.zeros(n_)
        for k in range(int(d * 14)):
            p_ = rng.integers(0, n_ - 400); y_[p_:p_ + 300] += rng.standard_normal(300) * np.exp(-np.arange(300) / 40) * 0.25
        return y_
    def grind(d):
        tt = np.arange(int(d * SR)) / SR
        from scipy.signal import butter, sosfilt
        nz = sosfilt(butter(2, [80, 600], "band", fs=SR, output="sos"), rng.standard_normal(len(tt)))
        am = 0.6 + 0.4 * np.sin(2 * np.pi * 7 * tt) ** 2
        return nz / (np.abs(nz).max() + 1e-6) * am * np.sin(np.pi * tt / d) * 0.6
    from scipy.signal import butter, sosfilt
    def soft_thud():
        tt = np.arange(int(0.4 * SR)) / SR
        body = np.sin(2 * np.pi * (85 + 40 * np.exp(-tt * 25)) * tt) * np.exp(-tt * 16)
        nz = sosfilt(butter(2, 900, "low", fs=SR, output="sos"), rng.standard_normal(len(tt))) * np.exp(-tt * 30)
        grit = sosfilt(butter(2, [1500, 5000], "band", fs=SR, output="sos"), rng.standard_normal(len(tt))) * np.exp(-tt * 60) * 0.25
        return (body * 0.7 + nz * 0.5 + grit) * 0.55
    s0 = S[0]
    for ht in [0.25, 0.75, 1.25, 1.7]: put(s0["t0"] + ht, soft_thud())
    for s_ in S:
        if s_.get("tr") == "whip": put(max(s_["t0"] - 0.08, 0), whoosh(0.3), 0.35)
        if s_.get("tr") == "reveal": put(s_["t0"], boom(), 0.35)
        if s_.get("draw") and any(getattr(f, "__name__", "") == "door" for f in s_["draw"]):
            put(s_["t0"] + 0.2, grind(min(2.2, s_["t1"] - s_["t0"] - 0.2)), 0.45)
    return y


# ---------------- main ----------------
def init(p, shots, wd):
    global P, SHOTS, WORDS, WORLD, VIG
    P, SHOTS, WORDS = p, shots, wd
    WORLD = Image.open(os.path.join(P, "world.png")); WORLD.load()
    VIG = make_vig()
    global GRAIN
    rng = np.random.default_rng(5)
    base = (rng.standard_normal((H // 2, W // 2)) * 2.2).astype(np.int16)
    big = np.kron(base, np.ones((2, 2), np.int16))
    GRAIN = [np.roll(np.roll(big, k * 53, 0), k * 29, 1) for k in range(16)]


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
