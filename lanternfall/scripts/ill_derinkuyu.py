#!/usr/bin/env python3
"""Illustrated 2D story short: Derinkuyu. Flat side-view world (surface village + underground cross-section),
code-drawn characters, camera moving through one big world, one-word captions.
  ill_derinkuyu.py <project_dir>   (needs aud/line_NNN.wav)"""
import sys, os, json, math, subprocess, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from multiprocessing import Pool

W, H, FPS = 1080, 1920, 30
WW, WH = 2160, 4900          # world size (1x units)
SS = 2                       # world raster scale
GY = 900                     # ground line
LX0, LX1 = 640, 1520         # city x range
LEVY = [GY + 520 + i * 410 for i in range(8)]   # level floor y
FONT = os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "fonts", "Inter.ttf")
P = None
TL = None
WORLD = None
WORDS = []

C = dict(sky1=(196, 214, 222), sky2=(236, 228, 210), sun=(250, 240, 205), ground=(139, 94, 62),
         ground2=(122, 82, 54), strata=(110, 74, 49), rock=(58, 42, 32), rockrim=(168, 124, 88),
         room=(46, 34, 27), house=(222, 190, 150), house2=(205, 170, 128), roof=(166, 118, 80),
         win=(70, 55, 45), stone=(170, 160, 146), stone2=(138, 128, 116), water=(96, 150, 190),
         fire=(255, 170, 60), glow=(255, 210, 120), soot=(25, 20, 18), tree=(98, 140, 80))


@functools.lru_cache(maxsize=32)
def font(size, w=800):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([14, w])
    except Exception: pass
    return f


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


# ---------------- static world ----------------
def build_world():
    im = Image.new("RGB", (WW * SS, WH * SS), C["ground"])
    d = ImageDraw.Draw(im)
    S = lambda v: int(v * SS)
    # sky gradient
    for y in range(0, GY):
        a = y / GY
        col = tuple(int(C["sky1"][i] * (1 - a) + C["sky2"][i] * a) for i in range(3))
        d.rectangle([0, S(y), S(WW), S(y + 1)], fill=col)
    d.ellipse([S(1650), S(250), S(1790), S(390)], fill=C["sun"])
    # distant hills
    for k, (x0, w, h) in enumerate([(0, 700, 120), (500, 900, 90), (1300, 900, 130)]):
        d.ellipse([S(x0), S(GY - h), S(x0 + w), S(GY + h)], fill=(214, 196, 168))
    # ground with strata
    d.rectangle([0, S(GY), S(WW), S(WH)], fill=C["ground"])
    rng = np.random.default_rng(4)
    for i in range(70):
        y = GY + 40 + i * 62 + rng.integers(-10, 10)
        d.line([(0, S(y)), (S(WW), S(y + rng.integers(-14, 14)))], fill=C["strata"], width=S(2))
    for i in range(400):
        x, y = rng.integers(0, WW), rng.integers(GY + 30, WH)
        r = rng.integers(3, 9)
        d.ellipse([S(x - r), S(y - r * 0.7), S(x + r), S(y + r * 0.7)], fill=C["ground2"])
    # ghost cities (undiscovered) far left / right
    for gx in (120, 1880):
        for i in range(5):
            y = GY + 700 + i * 520
            d.rounded_rectangle([S(gx - 70), S(y - 60), S(gx + 70), S(y)], radius=S(20), outline=(160, 118, 84), width=S(3))
        d.text((S(gx), S(GY + 500)), "?", font=font(S(160), 900), fill=(160, 118, 84), anchor="mm")
    # village houses on surface
    def house(x, w, h, main=False):
        d.rectangle([S(x), S(GY - h), S(x + w), S(GY)], fill=C["house"] if not main else C["house2"])
        d.rectangle([S(x - 8), S(GY - h - 14), S(x + w + 8), S(GY - h)], fill=C["roof"])
        for wx in range(x + 22, x + w - 30, 52):
            d.rectangle([S(wx), S(GY - h + 30), S(wx + 24), S(GY - h + 58)], fill=C["win"])
        d.rectangle([S(x + w // 2 - 16), S(GY - 60), S(x + w // 2 + 16), S(GY)], fill=C["win"])
    for x, w, h in [(260, 150, 120), (430, 120, 95), (1580, 160, 125), (1770, 130, 100), (1940, 150, 115)]:
        house(x, w, h)
    house(820, 230, 160, main=True)            # the man's house
    for tx in (580, 1160, 1450, 2060):
        d.rectangle([S(tx - 6), S(GY - 70), S(tx + 6), S(GY)], fill=(110, 80, 55))
        d.ellipse([S(tx - 40), S(GY - 150), S(tx + 40), S(GY - 60)], fill=C["tree"])
    # basement under main house
    bx0, bx1, by0, by1 = 820, 1050, GY + 20, GY + 260
    d.rectangle([S(bx0), S(by0), S(bx1), S(by1)], fill=(84, 66, 52))
    for k in range(6):  # stairs from house into basement
        d.rectangle([S(840 + k * 22), S(GY + 20 + k * 36), S(866 + k * 22), S(GY + 30 + k * 36)], fill=(120, 96, 74))
    # tunnel behind the wall, then stairs to level 0
    ty0, ty1 = GY + 170, GY + 250
    d.rectangle([S(1090), S(ty0), S(1400), S(ty1)], fill=C["rock"])
    path_stairs(d, S, 1400, ty1, LX1 - 60, LEVY[0])
    # levels
    for i, y in enumerate(LEVY):
        d.rounded_rectangle([S(LX0), S(y - 150), S(LX1), S(y)], radius=S(40), fill=C["room"], outline=C["rockrim"], width=S(4))
        # connecting stairs
        if i < 7:
            if i % 2 == 0:
                path_stairs(d, S, LX0 + 40, y, LX0 + 140, LEVY[i + 1], left=True)
            else:
                path_stairs(d, S, LX1 - 40, y, LX1 - 140, LEVY[i + 1])
        # rolled-aside stone door near stair entrance
        dx = LX0 + 120 if i % 2 == 0 else LX1 - 120
        if i != 4:
            stone_door(d, S, dx + (60 if i % 2 == 0 else -60), y - 58, 56)
        room_props(d, S, i, y)
    # ventilation shaft
    d.rectangle([S(LX1 + 70), S(GY), S(LX1 + 100), S(LEVY[-1])], fill=C["rock"])
    for i, y in enumerate(LEVY):
        d.rectangle([S(LX1), S(y - 110), S(LX1 + 85), S(y - 80)], fill=C["rock"])
    return im


def path_stairs(d, S, x0, y0, x1, y1, left=False):
    steps = 10
    for k in range(steps):
        a = k / steps
        x = x0 + (x1 - x0) * a
        y = y0 + (y1 - 150 + 150 - y0) * a
        d.rectangle([S(min(x, x + 60) - 30), S(y - 70), S(x + 30), S(y + 4)], fill=C["rock"])
        d.rectangle([S(x - 30), S(y), S(x + 30), S(y + 6)], fill=(90, 66, 50))


def stone_door(d, S, x, y, r):
    d.ellipse([S(x - r), S(y - r), S(x + r), S(y + r)], fill=C["stone"], outline=C["stone2"], width=S(5))
    d.ellipse([S(x - 12), S(y - 12), S(x + 12), S(y + 12)], fill=C["stone2"])


def room_props(d, S, i, y):
    if i == 0:   # stable: hay + troughs
        for x in range(820, 1350, 140):
            d.rectangle([S(x), S(y - 26), S(x + 90), S(y)], fill=(196, 160, 80))
    elif i == 1:  # kitchen: soot ceiling + oven
        d.rounded_rectangle([S(LX0 + 200), S(y - 150), S(LX1 - 200), S(y - 112)], radius=S(30), fill=C["soot"])
        for x in (900, 1200):
            d.ellipse([S(x - 50), S(y - 70), S(x + 50), S(y + 10)], fill=(120, 80, 55))
            d.ellipse([S(x - 22), S(y - 40), S(x + 22), S(y)], fill=(40, 20, 10))
    elif i == 2:  # storage jars
        for x in range(800, 1400, 70):
            d.ellipse([S(x - 22), S(y - 70), S(x + 22), S(y)], fill=(176, 112, 70))
            d.rectangle([S(x - 10), S(y - 82), S(x + 10), S(y - 66)], fill=(150, 95, 60))
    elif i == 3:  # well
        d.rectangle([S(1050), S(y - 40), S(1130), S(y + 120)], fill=C["water"])
        d.rectangle([S(1040), S(y - 50), S(1140), S(y - 38)], fill=C["stone2"])
    elif i == 4:  # hall pillars
        for x in range(820, 1400, 120):
            d.rectangle([S(x), S(y - 150), S(x + 26), S(y)], fill=C["rockrim"])
    elif i == 5:  # chapel cross niche
        cx = 1080
        d.rectangle([S(cx - 12), S(y - 130), S(cx + 12), S(y - 20)], fill=C["glow"])
        d.rectangle([S(cx - 45), S(y - 100), S(cx + 45), S(y - 76)], fill=C["glow"])
    elif i == 7:
        d.text((S(1080), S(y - 75)), "85 m", font=font(S(60), 900), fill=C["rockrim"], anchor="mm")


# ---------------- sprites ----------------
def person(d, x, y, s, body, head=(232, 190, 150), cap=None, mustache=False, phase=0.0, walk=False,
           lamp=False, torch=False, arm=0.0, hammer=False, crouch=False, t=0.0):
    """x,y feet (screen px), s scale (px per world unit)."""
    leg = 34 * s * (0.6 if crouch else 1)
    sw = math.sin(phase) * 9 * s if walk else 0
    hip = y - leg
    d.line([(x - 5 * s, hip), (x - 5 * s + sw, y)], fill=(60, 50, 45), width=max(2, int(7 * s)))
    d.line([(x + 5 * s, hip), (x + 5 * s - sw, y)], fill=(60, 50, 45), width=max(2, int(7 * s)))
    bh = 40 * s
    d.rounded_rectangle([x - 13 * s, hip - bh, x + 13 * s, hip + 2 * s], radius=int(8 * s), fill=body)
    hy = hip - bh - 12 * s
    d.ellipse([x - 12 * s, hy - 12 * s, x + 12 * s, hy + 12 * s], fill=head)
    d.ellipse([x + 3 * s, hy - 3 * s, x + 7 * s, hy + 1 * s], fill=(40, 30, 25))   # eye (facing right)
    if mustache:
        d.line([(x + 1 * s, hy + 5 * s), (x + 10 * s, hy + 5 * s)], fill=(70, 50, 40), width=max(2, int(3 * s)))
    if cap:
        d.pieslice([x - 13 * s, hy - 16 * s, x + 13 * s, hy + 6 * s], 180, 360, fill=cap)
        d.rectangle([x, hy - 6 * s, x + 18 * s, hy - 3 * s], fill=cap)
    sx, sy = x + 6 * s, hip - bh + 8 * s
    ang = -0.6 + arm
    hx, hy2 = sx + math.cos(ang) * 30 * s, sy + math.sin(ang + 1.6) * 26 * s
    d.line([(sx, sy), (hx, hy2)], fill=body, width=max(2, int(7 * s)))
    if hammer:
        d.line([(hx, hy2), (hx + 6 * s, hy2 - 26 * s)], fill=(110, 80, 50), width=max(2, int(4 * s)))
        d.rectangle([hx - 2 * s, hy2 - 34 * s, hx + 16 * s, hy2 - 24 * s], fill=(90, 90, 95))
    if lamp or torch:
        fl = 1 + 0.12 * math.sin(t * 23 + x)
        g = (255, 170, 60) if torch else C["glow"]
        r = (16 if torch else 11) * s * fl
        glow = 60 * s * fl
        return (hx, hy2 - 6 * s, r, glow, g)
    return None


def goat(d, x, y, s, phase):
    bob = math.sin(phase) * 2 * s
    d.ellipse([x - 26 * s, y - 40 * s + bob, x + 22 * s, y - 14 * s + bob], fill=(236, 230, 220))
    d.ellipse([x + 14 * s, y - 50 * s + bob, x + 34 * s, y - 32 * s + bob], fill=(236, 230, 220))
    for lx in (-18, -6, 6, 16):
        d.line([(x + lx * s, y - 16 * s), (x + lx * s, y)], fill=(90, 80, 70), width=max(2, int(4 * s)))


def glow_layer(size, lights):
    if not lights: return None
    lay = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for (x, y, r, g, col) in lights:
        d.ellipse([x - g, y - g, x + g, y + g], fill=col + (60,))
    lay = lay.filter(ImageFilter.GaussianBlur(25))
    d = ImageDraw.Draw(lay)
    for (x, y, r, g, col) in lights:
        d.ellipse([x - r, y - r, x + r, y + r], fill=col + (255,))
    return lay


# ---------------- timeline / camera ----------------
def line_times():
    out, cur = [], 0.25
    for i in range(12):
        p = os.path.join(P, "aud", f"line_{i:03d}.wav")
        dur = float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                                   capture_output=True, text=True).stdout)
        out.append((cur, cur + dur, p))
        cur += dur + (0.35 if i not in (0, 4, 9) else 0.6)
    return out, cur + 0.4


CAM = [  # (cx, cy, zoom) target per line
    (1000, 1000, 1.9), (1080, 1100, 2.1), (1220, 1110, 1.9), (1300, 1300, 1.25), (1080, 1900, 1.05),
    (1080, 2650, 0.5), (LX0 + 120, LEVY[4] - 60, 2.3), (1080, 2300, 0.7), (1080, 1180, 1.0),
    (900, 820, 1.35), (1080, 1000, 1.0), (1080, 2600, 0.5)]


def camera(t):
    idx = 0
    for i, (a, b, _) in enumerate(TL):
        if t >= a: idx = i
    a, b, _ = TL[idx]
    prev = CAM[idx - 1] if idx > 0 else CAM[0]
    cur = CAM[idx]
    k = ease((t - a) / (1.1 if idx not in (5, 11) else 2.0))
    cx = prev[0] + (cur[0] - prev[0]) * k
    cy = prev[1] + (cur[1] - prev[1]) * k
    z = math.exp(math.log(prev[2]) + (math.log(cur[2]) - math.log(prev[2])) * k)
    # line 3: follow the man downward
    if idx == 3:
        u = ease((t - a) / (b - a + 0.3))
        cy = 1250 + (LEVY[1] - 1250) * u
        cx = 1300 - 120 * u
    if idx == 4:
        u = (t - a) / (b - a + 0.6)
        cy = LEVY[0] - 200 + (LEVY[3] - LEVY[0]) * ease(u)
    # ending: return to start framing for loop
    end = TL[-1][1] + 0.4
    if t > end - 1.6:
        k2 = ease((t - (end - 1.6)) / 1.4)
        cx, cy = cx + (CAM[0][0] - cx) * k2, cy + (CAM[0][1] - cy) * k2
        z = math.exp(math.log(z) + (math.log(CAM[0][2]) - math.log(z)) * k2)
    return cx, cy, z, idx


def render(t):
    cx, cy, z, idx = camera(t)
    z = max(z, W / WW + 1e-3)
    vw, vh = W / z, H / z
    x0, y0 = cx - vw / 2, cy - vh / 2
    x0 = min(max(x0, 0), WW - vw); y0 = min(max(y0, 0), WH - vh)
    box = (x0 * SS, y0 * SS, (x0 + vw) * SS, (y0 + vh) * SS)
    fr = WORLD.resize((W, H), Image.BILINEAR, box=box)
    d = ImageDraw.Draw(fr)
    T = lambda X, Y: ((X - x0) * z, (Y - y0) * z)
    s = z
    a, b, _ = TL[idx]
    lt = t - a
    lights = []
    end = TL[-1][1] + 0.4
    wall_broken = (idx >= 1 or (idx == 0 and lt > 2.6)) and not (t > end - 0.5)
    # the basement wall
    if not wall_broken:
        wx, wy = T(1050, GY + 20)
        d.rectangle([wx, wy, wx + 40 * s, wy + 240 * s], fill=C["stone"])
        for k in range(6):
            d.line([(wx, wy + k * 40 * s), (wx + 40 * s, wy + k * 40 * s)], fill=C["stone2"], width=max(1, int(3 * s)))
        if idx == 0 and lt > 1.4:
            d.line([(wx + 20 * s, wy + 90 * s), (wx + 6 * s, wy + 160 * s)], fill=(60, 50, 40), width=max(2, int(4 * s)))
    else:
        wx, wy = T(1050, GY + 20)
        d.rectangle([wx, wy, wx + 40 * s, wy + 140 * s], fill=C["stone"])
        for k in range(5):  # rubble
            rx, ry = T(1040 + k * 14, GY + 250)
            d.ellipse([rx - 8 * s, ry - 10 * s, rx + 8 * s, ry], fill=C["stone2"])
    # cold air streaks
    if idx in (1, 2):
        for k in range(14):
            ph = (lt * 120 + k * 37) % 300
            ax, ay = T(1110 + ph * -0.9 + 200, GY + 180 + (k % 5) * 14)
            d.line([(ax, ay), (ax + 30 * s, ay)], fill=(220, 236, 250), width=max(1, int(3 * s)))
    # the man
    if idx == 0:
        swing = math.sin(lt * 9) if lt < 2.6 else 0
        L = person(d, *T(1000, GY + 260), s * 1.4, (120, 84, 60), cap=(70, 60, 55), mustache=True, arm=swing * 0.9, hammer=True, t=t)
    elif idx == 1:
        L = person(d, *T(1000, GY + 260), s * 1.4, (120, 84, 60), cap=(70, 60, 55), mustache=True, lamp=True, t=t)
    elif idx == 2:
        u = ease(lt / max(b - a, 0.1))
        mx = 1010 + (1380 - 1010) * u
        L = person(d, *T(mx, GY + 250), s * 1.1, (120, 84, 60), cap=(70, 60, 55), mustache=True, walk=True,
                   phase=lt * 8, lamp=True, crouch=True, t=t)
    elif idx == 3:
        u = ease(lt / max(b - a, 0.1))
        if u < 0.5:
            v = u / 0.5; mx, my = 1400 + (LX1 - 60 - 1400) * v, GY + 250 + (LEVY[0] - GY - 250) * v
        else:
            v = (u - 0.5) / 0.5; mx, my = LX1 - 40 + (LX1 - 140 - LX1 + 40) * v, LEVY[0] + (LEVY[1] - LEVY[0]) * v
        L = person(d, *T(mx, my), s * 1.2, (120, 84, 60), cap=(70, 60, 55), mustache=True, walk=True, phase=lt * 8, lamp=True, t=t)
    else:
        L = None
    if L: lights.append((L[0], L[1], L[2], L[3], L[4]))
    # stable goats & room lamps when underground visible
    for i, y in enumerate(LEVY):
        lx, ly = T(LX0 + 300, y - 120)
        if -100 < ly < H + 100:
            lights.append((lx, ly, 6 * s, 50 * s, C["glow"]))
            lx2, ly2 = T(LX1 - 300, y - 120)
            lights.append((lx2, ly2, 6 * s, 50 * s, C["glow"]))
        if i == 0:
            for k, gx in enumerate((860, 980, 1110)):
                goat(d, *T(gx, y), s, t * 3 + k)
        if i == 1 and idx >= 4:  # kitchen fires
            for fx in (900, 1200):
                X, Y = T(fx, y - 20)
                lights.append((X, Y, 12 * s, 70 * s, C["fire"]))
    # people / crowd count
    if idx == 5:
        n = int(min(1, lt / 2.5) * 260)
        rng = np.random.default_rng(1)
        for k in range(n):
            lv = k % 8; px = rng.uniform(LX0 + 60, LX1 - 60)
            X, Y = T(px, LEVY[lv] - 4)
            col = [(200, 80, 70), (80, 120, 180), (210, 170, 70), (90, 150, 100)][k % 4]
            d.rectangle([X - 3, Y - 10, X + 3, Y], fill=col)
            d.ellipse([X - 3, Y - 16, X + 3, Y - 10], fill=(232, 190, 150))
        cnt = int(min(1, lt / 2.5) * 20000)
        caption_box(d, f"{cnt:,}", 1500, (255, 200, 80), 120)
        caption_box(d, "8 LEVELS · 85 m", 1640, (255, 255, 255), 56)
    # stone door rolling (line 6)
    if idx == 6:
        p = ease((lt - 0.8) / 2.0)
        dx = LX0 + 260 - (140 * p)
        X, Y = T(dx, LEVY[4] - 58)
        r = 56 * s
        d.ellipse([X - r, Y - r, X + r, Y + r], fill=C["stone"], outline=C["stone2"], width=max(2, int(5 * s)))
        ang = -p * 2.6
        hx, hy = X + math.cos(ang) * 22 * s, Y + math.sin(ang) * 22 * s
        d.ellipse([hx - 12 * s, hy - 12 * s, hx + 12 * s, hy + 12 * s], fill=C["stone2"])
        person(d, *T(LX0 + 330, LEVY[4]), s * 1.0, (90, 110, 150), t=t, arm=-0.8)
    # families going down (line 7) and hiding (8,9)
    if idx in (7, 8, 9):
        cols = [(170, 80, 70), (80, 110, 160), (200, 160, 70), (90, 140, 100), (150, 90, 140)]
        for k in range(10):
            u = ((lt * 0.12 + k * 0.1) % 1.0) if idx == 7 else 0.15 + k * 0.08
            lv = min(int(u * 4), 3)
            px = LX0 + 120 + ((u * 4) % 1) * (LX1 - LX0 - 240)
            X, Y = T(px, LEVY[lv + 1])
            Lp = person(d, X, Y, s * (0.85 if k % 3 else 0.65), cols[k % 5], walk=(idx == 7), phase=t * 7 + k,
                        lamp=(k % 4 == 0), t=t)
            if Lp: lights.append(Lp)
    if idx in (8, 9):
        for k in range(5):
            ux = (lt * 60 + k * 70) if idx == 8 else 600 + k * 110
            X, Y = T(min(ux + 300, 1500), GY)
            Lp = person(d, X, Y, s * 1.15, (110, 40, 40), cap=(40, 30, 30), walk=(idx == 8), phase=t * 8 + k, torch=True, t=t)
            if Lp: lights.append(Lp)
        if idx == 9 and lt > 0.8:
            X, Y = T(1000, GY - 200)
            d.text((X, Y), "?", font=font(int(90 * s), 900), fill=(255, 255, 255), anchor="mm", stroke_width=6, stroke_fill=(0, 0, 0))
    if idx == 10:
        cols = [(70, 140, 200), (230, 120, 90), (240, 200, 80), (120, 180, 120), (180, 100, 180)]
        for k in range(8):
            X, Y = T(((lt * 40 + k * 140) % 1400) + 400, GY)
            person(d, X, Y, s * 1.0, cols[k % 5], walk=True, phase=t * 7 + k, t=t)
        X, Y = T(1200, GY - 170)
        d.rounded_rectangle([X - 130 * s, Y - 30 * s, X + 130 * s, Y + 30 * s], radius=int(8 * s), fill=(120, 70, 40))
        d.text((X, Y), "DERINKUYU", font=font(int(34 * s), 900), fill=(255, 240, 210), anchor="mm")
    # glow
    lay = glow_layer(fr.size, lights)
    if lay: fr.paste(lay, (0, 0), lay)
    # darken underground slightly for mood when deep
    words(fr, t)
    return fr


def caption_box(d, txt, y, col, size):
    d.text((W / 2, y), txt, font=font(size, 900), fill=col, anchor="mm", stroke_width=8, stroke_fill=(0, 0, 0))


KEY = {"city", "eight", "levels", "eighty", "five", "meters", "twenty", "thousand", "hide", "silence", "derinkuyu",
       "inside", "door", "underground", "raiders", "sleeping", "wall"}


def words(fr, t):
    d = ImageDraw.Draw(fr)
    for a, b, w in WORDS:
        if a <= t < b:
            col = (255, 205, 60) if w.lower().strip(".,") in KEY else (255, 255, 255)
            d.text((W / 2, 330), w.strip(".,?!"), font=font(96, 900), fill=col, anchor="mm", stroke_width=10, stroke_fill=(20, 15, 10))
            break


def make_words():
    from faster_whisper import WhisperModel
    m = WhisperModel("small", device="cpu", compute_type="int8")
    lines = [x[0] for x in json.load(open(os.path.join(P, "lines_in.json")))]
    out = []
    for (a, b, p), text in zip(TL, lines):
        raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", p, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
        x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
        segs, _ = m.transcribe(x, language="en", word_timestamps=True)
        ws = [w for s_ in segs for w in s_.words]
        toks = text.replace("...", " ").split()
        if not ws: continue
        t0, t1 = ws[0].start, ws[-1].end
        if len(ws) == len(toks):
            for w, tk in zip(ws, toks): out.append((a + w.start, a + w.end, tk))
        else:
            tot = sum(len(k) + 2 for k in toks); acc = 0
            for tk in toks:
                s0 = t0 + (t1 - t0) * acc / tot; acc += len(tk) + 2
                out.append((a + s0, a + t0 + (t1 - t0) * acc / tot, tk))
    out.sort()
    res = []
    for k, (a, b, w) in enumerate(out):
        nxt = out[k + 1][0] if k + 1 < len(out) else b + 0.3
        res.append((a, max(b, min(nxt, a + 0.6)), w))
    return res


def init(p, tl, wd):
    global P, TL, WORLD, WORDS
    P, TL, WORDS = p, tl, wd
    WORLD = Image.open(os.path.join(P, "world.png"))
    WORLD.load()


def frame(t):
    return render(t).tobytes()


def main(p):
    global P, TL
    P = os.path.abspath(p)
    TL, total = line_times()
    if not os.path.exists(os.path.join(P, "world.png")):
        build_world().save(os.path.join(P, "world.png"))
    wd = make_words()
    os.makedirs(os.path.join(P, "out"), exist_ok=True)
    voice = [(a, pth) for a, b, pth in TL]
    json.dump({"total": total, "voice": voice}, open(os.path.join(P, "out", "timeline.json"), "w"))
    lim = float(os.environ.get("LIMIT", total))
    n = int(min(total, lim) * FPS)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
                            os.path.join(P, "out", "video_noaudio.mp4")], stdin=subprocess.PIPE)
    with Pool(4, initializer=init, initargs=(P, TL, wd)) as pool:
        for bts in pool.imap(frame, (i / FPS for i in range(n)), chunksize=6):
            enc.stdin.write(bts)
    enc.stdin.close(); enc.wait()
    print("done", total)


if __name__ == "__main__":
    main(sys.argv[1])
