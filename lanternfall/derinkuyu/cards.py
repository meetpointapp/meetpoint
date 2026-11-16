"""Animated info cards for the Derinkuyu long video. make(name, spec, t, dur, P) -> PIL RGB 1920x1080"""
import os, json, math, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, SS = 1920, 1080, 2
AMBER = (255, 178, 72)
CREAM = (244, 234, 214)
BG = (20, 17, 13)
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "..", "fonts")


@functools.lru_cache(maxsize=64)
def F(name, size, wght=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), size * SS)
    if wght:
        try:
            axes = f.get_variation_axes()
            f.set_variation_by_axes([wght] if len(axes) == 1 else [14, wght])
        except Exception:
            pass
    return f


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


@functools.lru_cache(maxsize=2)
def stone_bg():
    rng = np.random.default_rng(3)
    n = rng.standard_normal((H // 8, W // 8))
    im = Image.fromarray(((n - n.min()) / (n.max() - n.min()) * 255).astype(np.uint8)).resize((W * SS, H * SS), Image.BICUBIC)
    im = im.filter(ImageFilter.GaussianBlur(6))
    a = np.asarray(im, np.float32) / 255
    base = np.array(BG, np.float32)
    rgb = base[None, None, :] * (0.75 + 0.5 * a[..., None])
    y, x = np.ogrid[:H * SS, :W * SS]
    r = np.sqrt(((x - W * SS / 2) / (W * SS / 2)) ** 2 + ((y - H * SS / 2) / (H * SS / 2)) ** 2)
    rgb *= (1 - 0.45 * np.clip(r - 0.4, 0, 1))[..., None]
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


def canvas():
    return stone_bg().copy()


def done(im):
    return im.resize((W, H), Image.LANCZOS)


def S(v):
    return int(v * SS)


def text(d, xy, s, f, fill=CREAM, a=1.0, anchor="la"):
    if a <= 0: return
    col = tuple(int(c * a + b * (1 - a)) for c, b in zip(fill, BG))
    d.text((S(xy[0]), S(xy[1])), s, font=f, fill=col, anchor=anchor)


def mix(c, a):
    return tuple(int(x * a + b * (1 - a)) for x, b in zip(c, BG))


# ---------------- map ----------------
@functools.lru_cache(maxsize=1)
def geo():
    d = json.load(open(os.path.join(HERE, "..", "geo", "countries.geojson")))
    keep = {}
    for f in d["features"]:
        lon_ok = False
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for p in polys:
            xs = [c[0] for c in p[0]]; ys = [c[1] for c in p[0]]
            if max(xs) > 18 and min(xs) < 50 and max(ys) > 30 and min(ys) < 46: lon_ok = True
        if lon_ok: keep[f["properties"]["name"]] = polys
    return keep


PLACES = {"Derinkuyu": (34.735, 38.374), "Kaymaklı": (34.751, 38.462), "Nevşehir": (34.712, 38.625),
          "Ankara": (32.866, 39.925), "Istanbul": (28.978, 41.008)}


def map_card(spec, t, dur):
    im = canvas(); d = ImageDraw.Draw(im)
    z = ease(t / max(dur * 0.8, 0.1))
    # view: lon/lat window interpolating from Turkey to Cappadocia
    v0 = (25.0, 45.5, 35.0, 43.0)   # lon_min, lon_max, lat_min, lat_max
    v1 = spec.get("view", (32.6, 36.9, 37.35, 39.75))
    if spec.get("static"): z = 1.0
    lon0 = v0[0] + (v1[0] - v0[0]) * z; lon1 = v0[1] + (v1[1] - v0[1]) * z
    lat_c = (v0[2] + v0[3]) / 2 * (1 - z) + (v1[2] + v1[3]) / 2 * z
    k = math.cos(math.radians(39))
    sx = W * SS / ((lon1 - lon0) * k)
    def P(lon, lat):
        return ((lon - lon0) * k * sx, H * SS / 2 - (lat - lat_c) * sx)
    for name, polys in geo().items():
        tr = name == "Turkey"
        for p in polys:
            pts = [P(*c) for c in p[0]]
            d.polygon(pts, fill=(52, 44, 34) if tr else (30, 26, 21), outline=(120, 100, 70) if tr else (60, 52, 42))
            if tr: d.line(pts + [pts[0]], fill=mix(AMBER, 0.55), width=S(2))
    # sea label
    a = 1 - z
    text(d, P(34, 34.3), "MEDITERRANEAN SEA", F("Inter.ttf", 22, 500), (110, 120, 130), a * 0.8, "mm")
    text(d, P(34.5, 42.6), "BLACK SEA", F("Inter.ttf", 22, 500), (110, 120, 130), a * 0.8, "mm")
    text(d, P(35, 39.4), "TÜRKİYE", F("Cinzel.ttf", 48, 700), (150, 130, 100), a * 0.9, "mm")
    names = spec.get("places", ["Derinkuyu", "Nevşehir", "Ankara"])
    for nm in names:
        x, y = P(*PLACES[nm])
        main = nm == "Derinkuyu" or nm in spec.get("hl", [])
        r = S(13 if main else 7)
        pulse = (math.sin(t * 3) + 1) / 2
        if main:
            rr = r + S(10 + 14 * pulse)
            d.ellipse([x - rr, y - rr, x + rr, y + rr], outline=mix(AMBER, 0.5 * (1 - pulse)), width=S(3))
        d.ellipse([x - r, y - r, x + r, y + r], fill=AMBER if main else CREAM)
        d.text((x + S(24), y), nm, font=F("Inter.ttf", 40 if main else 30, 700 if main else 500),
               fill=CREAM if main else (200, 190, 170), anchor="lm")
    if spec.get("tunnel"):
        x0, y0 = P(*PLACES["Derinkuyu"]); x1, y1 = P(*PLACES["Kaymaklı"])
        prog = ease((t - 0.8) / 2.5)
        n = 26
        for i in range(int(n * prog)):
            if i % 2: continue
            a0, a1 = i / n, (i + 1) / n
            d.line([(x0 + (x1 - x0) * a0, y0 + (y1 - y0) * a0), (x0 + (x1 - x0) * a1, y0 + (y1 - y0) * a1)], fill=AMBER, width=S(6))
        text(d, ((x0 + x1) / 2 / SS - 40, (y0 + y1) / 2 / SS), "≈ 9 km", F("Inter.ttf", 40, 700), AMBER, prog, "rm")
        text(d, (W / 2, 90), "A tunnel between them? Never fully proven.", F("Inter.ttf", 30, 500), (220, 210, 190), ease((t - 2) / 1), "mm")
    if spec.get("title"):
        text(d, (90, 110), spec["title"], F("Cinzel.ttf", 64, 700), CREAM, ease(t / 0.8))
        if spec.get("sub"): text(d, (94, 175), spec["sub"], F("Inter.ttf", 30, 500), AMBER, ease((t - .3) / .8))
    return done(im)


# ---------------- cross-section ----------------
LEVELS = [("Stables", 8), ("Living rooms", 18), ("Kitchens", 28), ("Presses & stores", 38), ("Wells", 50),
          ("Meeting halls", 62), ("Chapel", 75), ("Deepest point", 85)]


def section_card(spec, t, dur):
    im = canvas(); d = ImageDraw.Draw(im)
    top, bot = 190, 1000                   # px for 0 m and 85 m
    def Y(m): return S(top + (bot - top) * m / 85)
    # ground
    d.rectangle([0, 0, S(W), Y(0)], fill=(34, 40, 52))
    d.rectangle([0, Y(0), S(W), S(H)], fill=(58, 47, 35))
    for i in range(40):  # strata lines
        yy = Y(2 + i * 2.2)
        d.line([(S(420), yy), (S(W), yy + S((i % 3) * 3))], fill=(66, 54, 40), width=S(2))
    # houses on surface
    for hx in range(560, 1800, 170):
        d.rectangle([S(hx), Y(0) - S(60), S(hx + 110), Y(0)], fill=(80, 70, 58))
        d.polygon([(S(hx - 10), Y(0) - S(60)), (S(hx + 55), Y(0) - S(100)), (S(hx + 120), Y(0) - S(60))], fill=(96, 80, 62))
    text(d, (W - 60, 120), "THE TOWN ABOVE", F("Inter.ttf", 26, 600), (180, 190, 210), 1, "ra")
    upto = spec.get("upto", len(LEVELS))
    hl = spec.get("hl")
    prog = ease(t / max(dur * 0.85, 0.1)) if spec.get("animate", True) else 1
    show = spec.get("from", 0) + (upto - spec.get("from", 0)) * prog
    # shaft
    if spec.get("shaft"):
        sh = ease(t / 1.5)
        d.rectangle([S(1720), Y(0), S(1750), Y(85 * sh)], fill=(20, 17, 13))
        for k in range(6):
            yy = ((t * 120 + k * 140) % (bot - top)) + top
            if yy < top + (bot - top) * sh:
                d.polygon([(S(1735), S(yy + 22)), (S(1723), S(yy)), (S(1747), S(yy))], fill=mix((150, 200, 255), 0.8))
        text(d, (1700, 240), "AIR SHAFT", F("Inter.ttf", 28, 700), (150, 200, 255), sh, "ra")
    # stair path + chambers
    prev = (S(1000), Y(0))
    for i, (nm, m) in enumerate(LEVELS):
        a = min(max(show - i, 0), 1)
        if a <= 0: break
        cx = 700 + (i % 2) * 300
        x0, x1 = S(cx), S(cx + 300)
        yc = Y(m)
        col = AMBER if (hl is not None and i == hl) or (hl is None and i == int(show)) else (210, 190, 160)
        d.line([prev, (S(cx + 150), yc)], fill=mix((24, 19, 14), a), width=S(12))
        prev = (S(cx + 150), yc)
    for i, (nm, m) in enumerate(LEVELS):
        a = min(max(show - i, 0), 1)
        if a <= 0: break
        cx = 700 + (i % 2) * 300
        x0, x1 = S(cx), S(cx + 300)
        yc = Y(m)
        col = AMBER if (hl is not None and i == hl) or (hl is None and i == int(show)) else (210, 190, 160)
        d.rounded_rectangle([x0, yc - S(24), x1, yc + S(24)], radius=S(20), fill=mix((24, 19, 14), a), outline=mix(col, a), width=S(3))
        if i % 2 == 0:
            d.text((x0 - S(24), yc), nm, font=F("Inter.ttf", 32, 600), fill=mix(col, a), anchor="rm")
        else:
            d.text((x1 + S(24), yc), nm, font=F("Inter.ttf", 32, 600), fill=mix(col, a), anchor="lm")
    # depth ruler
    for m in range(0, 86, 10):
        d.line([(S(300), Y(m)), (S(330), Y(m))], fill=(200, 180, 150), width=S(2))
        d.text((S(285), Y(m)), f"{m} m", font=F("Inter.ttf", 24, 500), fill=(200, 180, 150), anchor="rm")
    d.line([(S(330), Y(0)), (S(330), Y(85))], fill=(200, 180, 150), width=S(2))
    cur = LEVELS[min(int(show), len(LEVELS) - 1)][1] if show > 0 else 0
    if spec.get("marker", True) and show > 0:
        yy = Y(min(cur, 85))
        d.polygon([(S(340), yy), (S(370), yy - S(14)), (S(370), yy + S(14))], fill=AMBER)
    if spec.get("title"):
        text(d, (90, 70), spec["title"], F("Cinzel.ttf", 54, 700), CREAM, ease(t / .8))
    return done(im)


# ---------------- depth comparison ----------------
def depth_card(spec, t, dur):
    im = canvas(); d = ImageDraw.Draw(im)
    g0 = 260
    def Y(m): return S(g0 + m * 7.0)
    d.rectangle([0, 0, S(W), S(g0)], fill=(34, 40, 52))
    d.rectangle([0, S(g0), S(W), S(H)], fill=(58, 47, 35))
    text(d, (W / 2, 120), spec.get('title', 'Deeper than a 20-story building'), F('Cinzel.ttf', 56, 700), CREAM, ease(t / .8), 'mm')
    p = ease(t / 2.2)
    # building: 20 floors * 3.5 m = 70 m drawn downward as "if buried"
    b = ease((t - 1.0) / 2.0)
    for f in range(int(20 * b)):
        y = Y(f * 3.5)
        d.rectangle([S(560), y + S(2), S(800), y + S(26)], outline=(150, 170, 200), width=S(2))
    text(d, (680, g0 - 30), "20-STORY BUILDING", F("Inter.ttf", 28, 700), (170, 190, 220), b, "ms")
    text(d, (680, g0 + 70 * 7 + 40), "≈ 70 m", F("Inter.ttf", 34, 700), (170, 190, 220), b, "mm")
    d.rectangle([S(1100), S(g0), S(1220), Y(85 * p)], fill=(16, 13, 10))
    text(d, (1160, g0 - 30), "DERINKUYU", F("Inter.ttf", 28, 700), AMBER, 1, "ms")
    text(d, (1260, g0 + 85 * 7 * p), f"{int(85 * p)} m", F("Inter.ttf", 72, 800), AMBER, 1, "lm")
    text(d, (1260, g0 + 85 * 7 * p + 66), "dug by hand", F("Inter.ttf", 30, 500), CREAM, ease((t - 2.4) / .8), "lm")
    return done(im)


# ---------------- year / fact ----------------
def year_card(spec, t, dur):
    im = canvas(); d = ImageDraw.Draw(im)
    a = ease(t / 0.9)
    s = 1 + 0.04 * (t / dur)
    f = F("Cinzel.ttf", int(230 * s), 700)
    text(d, (W / 2, H / 2 - 40), spec["big"], f, AMBER, a, "mm")
    text(d, (W / 2, H / 2 + 120), spec.get("small", ""), F("Inter.ttf", 40, 500), CREAM, ease((t - .5) / .9), "mm")
    if spec.get("small2"):
        text(d, (W / 2, H / 2 + 180), spec["small2"], F("Inter.ttf", 30, 400), (200, 190, 170), ease((t - 1) / .9), "mm")
    return done(im)


# ---------------- rolling stone door ----------------
def door_card(spec, t, dur):
    im = canvas(); d = ImageDraw.Draw(im)
    yb = 820
    d.rectangle([S(200), S(yb), S(1720), S(yb + 30)], fill=(70, 58, 44))
    d.rectangle([S(200), S(380), S(1720), S(410)], fill=(70, 58, 44))
    d.rectangle([S(820), S(410), S(1100), S(yb)], fill=(8, 7, 6))          # doorway
    text(d, (960, 360), "PASSAGE", F("Inter.ttf", 28, 600), (190, 180, 160), 1, "ms")
    d.rectangle([S(1100), S(410), S(1520), S(yb)], fill=(48, 39, 29))      # slot in wall
    p = ease((t - 1.2) / 2.2) if spec.get("roll", True) else 0
    cx = 1310 - (1310 - 960) * p
    r = 205
    ang = -p * (350 / r)
    d.ellipse([S(cx - r), S(yb - 2 * r), S(cx + r), S(yb)], fill=(150, 128, 98), outline=(90, 74, 54), width=S(6))
    hx, hy = cx + 0.25 * r * math.cos(ang), yb - r + 0.25 * r * math.sin(ang)
    d.ellipse([S(hx - 40), S(hy - 40), S(hx + 40), S(hy + 40)], fill=(70, 58, 44))
    text(d, (cx, yb - r), "", F("Inter.ttf", 20), CREAM, 1, "mm")
    text(d, (1640, 300), "INSIDE", F("Cinzel.ttf", 56, 700), AMBER, 1, "mm")
    text(d, (1640, 345), "rolled from here", F("Inter.ttf", 30, 500), CREAM, ease((t - .6) / .8), "mm")
    text(d, (460, 520), "OUTSIDE", F("Cinzel.ttf", 44, 700), (150, 140, 120), 1, "mm")
    text(d, (W / 2, 960), spec.get("caption", "200–500 kg · 1–1.5 m wide · no grip from outside"),
         F("Inter.ttf", 32, 600), CREAM, ease((t - 2.8) / .8), "mm")
    return done(im)


# ---------------- timeline ----------------
TL = [("c. 800–600 BC", "Phrygians?"), ("c. 400 BC", "Xenophon"), ("AD 500–1000", "Byzantine growth"),
      ("1923", "Population exchange"), ("1963", "Rediscovered"), ("1969", "Opened to visitors"),
      ("1985", "UNESCO")]


def timeline_card(spec, t, dur):
    im = canvas(); d = ImageDraw.Draw(im)
    hl = spec.get("hl", 0)
    y = 560
    d.line([(S(140), S(y)), (S(1780), S(y))], fill=(110, 92, 70), width=S(4))
    n = len(TL)
    for i, (when, what) in enumerate(TL):
        x = 160 + i * (1600 / (n - 1))
        on = i == hl
        past = i < hl
        col = AMBER if on else ((210, 195, 170) if past else (110, 100, 86))
        r = 18 if on else 11
        d.ellipse([S(x - r), S(y - r), S(x + r), S(y + r)], fill=col)
        up = i % 2 == 0
        text(d, (x, y - 60 if up else y + 70), when, F("Inter.ttf", 36 if on else 28, 700), col, 1, "ms" if up else "mt")
        text(d, (x, y - 100 if up else y + 112), what, F("Inter.ttf", 30 if on else 25, 500), col, 1, "ms" if up else "mt")
    if spec.get("title"):
        text(d, (W / 2, 160), spec["title"], F("Cinzel.ttf", 60, 700), CREAM, ease(t / .8), "mm")
    return done(im)


def make(name, spec, t, dur, P):
    return {"map": map_card, "section": section_card, "depth": depth_card, "year": year_card,
            "door": door_card, "timeline": timeline_card}[name](spec, t, dur)
