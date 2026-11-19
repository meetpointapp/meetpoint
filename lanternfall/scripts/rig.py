"""Character rig v3: adult proportions, outlines, two-tone shading, articulated walk cycle (knees/elbows),
blinking, expressions, clothing, props, ground shadow. Draw on an RGBA layer at screen coordinates.

    draw_char(d, x, y, s, look, pose)
      x, y : screen position of the feet (ground contact)
      s    : pixels per world unit (character is ~110 units tall)
      look : dict  skin, shirt, vest, pants, shoes, hair, cap, beard, mustache, headscarf, helmet
      pose : dict  face(+1/-1), walk(phase or None), speed, expr('neutral'|'surprised'|'scared'|'smile'|'talk'|'shh'|'angry'),
                   t (seconds, for blink/flicker), crouch(0..1), prop('lamp'|'torch'|'hammer'|None), hammer(0..1 swing),
                   arm_up(0..1), kid(bool)
    returns list of light sources [(x, y, r, glow, color)]
"""
import math

OUT = (34, 26, 20)


def _shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


def _seg(d, a, b, wa, wb, col):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1e-3
    nx, ny = -dy / L, dx / L
    d.polygon([(a[0] + nx * wa / 2, a[1] + ny * wa / 2), (b[0] + nx * wb / 2, b[1] + ny * wb / 2),
               (b[0] - nx * wb / 2, b[1] - ny * wb / 2), (a[0] - nx * wa / 2, a[1] - ny * wa / 2)], fill=col)


def _limb(d, p0, p1, p2, w, col, ow):
    """tapered two-segment limb (thick at root, slimmer at the end) with outline and rounded joints"""
    ws = (w * 1.05, w * 0.92, w * 0.8)
    for pass_, c, add in ((0, OUT, 2 * ow), (1, col, 0)):
        _seg(d, p0, p1, ws[0] + add, ws[1] + add, c)
        _seg(d, p1, p2, ws[1] + add, ws[2] + add, c)
        for p, ww in zip((p0, p1, p2), ws):
            r = (ww + add) / 2
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=c)


def _chaikin(pts, n=3):
    for _ in range(n):
        q = []
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            q += [(a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25), (a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75)]
        pts = q
    return pts


def _ik(hip, foot, l1, l2, bend):
    """two-bone IK in 2D; bend = +1 (knee forward) or -1"""
    dx, dy = foot[0] - hip[0], foot[1] - hip[1]
    dist = max(1e-3, min(math.hypot(dx, dy), l1 + l2 - 1e-3))
    a = math.atan2(dy, dx)
    c = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)
    c = max(-1, min(1, c))
    b = math.acos(c)
    ang = a - bend * b
    return (hip[0] + math.cos(ang) * l1, hip[1] + math.sin(ang) * l1)


def draw_char(d, x, y, s, look, pose):
    face = pose.get("face", 1)
    t = pose.get("t", 0.0)
    if pose.get("tremble"):
        x = x + math.sin(t * 47) * 1.2 * s + math.sin(t * 31) * 0.8 * s
    kid = pose.get("kid", False)
    s = s * (0.72 if kid else 1.0)
    ow = max(1.0, 1.5 * s)
    crouch = pose.get("crouch", 0.0)
    skin = look.get("skin", (226, 182, 142))
    shirt = look.get("shirt", (196, 180, 150))
    vest = look.get("vest")
    pants = look.get("pants", (78, 66, 58))
    shoes = look.get("shoes", (52, 40, 32))
    lights = []

    # proportions (world units)
    walk = pose.get("walk")
    leg_l1, leg_l2 = 21 * s, 21 * s
    torso_h = 38 * s * (1 - 0.15 * crouch)
    head_r = 11.5 * s
    hip_h = (leg_l1 + leg_l2) * ((0.985 if walk is None else 0.95) - 0.35 * crouch)

    walk = pose.get("walk")
    ph = walk if walk is not None else 0.0
    bob = (abs(math.sin(ph)) * 2.2 * s) if walk is not None else 0.0
    hip = (x, y - hip_h + bob)
    stride = 14 * s if walk is not None else 0
    # feet positions
    fA = (x + math.sin(ph) * stride * face, y - max(0, math.cos(ph)) * 4 * s * (1 if walk is not None else 0))
    fB = (x - math.sin(ph) * stride * face, y - max(0, -math.cos(ph)) * 4 * s * (1 if walk is not None else 0))
    if walk is None:
        fA, fB = (x + 3 * s * face, y), (x - 3 * s * face, y)
    lean = (3.5 * s * face if walk is not None else 0) + 6 * s * face * crouch
    breath = (math.sin(t * 2.4 + x * 0.01) * 0.7 * s) if walk is None else 0.0   # idle breathing / sway
    neck = (hip[0] + lean + math.sin(t * 1.1 + x * 0.02) * 0.5 * s * (walk is None), hip[1] - torso_h + breath)
    shoulder = (neck[0] - 1 * s * face, neck[1] + 5 * s)

    # ground shadow
    d.ellipse([x - 16 * s, y - 3 * s, x + 16 * s, y + 3 * s], fill=(0, 0, 0, 70))

    # back leg
    kB = _ik((hip[0] - 2 * s * face, hip[1]), fB, leg_l1, leg_l2, face)
    _limb(d, (hip[0] - 2 * s * face, hip[1]), kB, fB, 9 * s, _shade(pants, 0.82), ow)
    d.ellipse([fB[0] - 3 * s, fB[1] - 4 * s, fB[0] + 9 * s * face if face > 0 else fB[0] + 3 * s, fB[1] + 1 * s], fill=shoes, outline=OUT)

    # back arm (behind torso)
    sw = math.sin(ph + math.pi) * 0.55 if walk is not None else 0.15
    eB = (shoulder[0] + math.sin(-sw) * 15 * s * face, shoulder[1] + math.cos(sw) * 15 * s)
    hB = (eB[0] + math.sin(-sw * 1.3 + 0.3 * face) * 13 * s * face, eB[1] + math.cos(sw * 1.3) * 13 * s)
    _limb(d, shoulder, eB, hB, 7.5 * s, _shade(shirt, 0.78), ow)

    # torso: rounded organic silhouette (chaikin-smoothed), collar, cloth folds
    w_sh, w_hip = 15 * s, 12 * s
    def tp(k, off):   # point at fraction k from neck (0) to hip (1), horizontal offset off
        return (neck[0] + (hip[0] - neck[0]) * k + off, neck[1] + 3 * s + (hip[1] + 4 * s - neck[1] - 3 * s) * k)
    prof = [(0.0, w_sh - 5 * s), (0.06, w_sh), (0.22, w_sh + 0.5 * s), (0.55, w_hip + 0.5 * s), (0.8, w_hip), (1.0, w_hip + 1 * s)]
    right = [tp(k, w) for k, w in prof]
    left = [tp(k, -w) for k, w in reversed(prof)]
    tor = _chaikin(right + left, 3)
    d.polygon(tor, fill=OUT)
    inner = [(neck[0] + (px - neck[0]) * 1, py) for px, py in tor]
    # shrink by outline width toward the torso centre
    cxm = (neck[0] + hip[0]) / 2; cym = (neck[1] + hip[1]) / 2
    inner = [(px + (cxm - px) * ow / max(w_sh, 1), py + (cym - py) * ow / max(torso_h, 1)) for px, py in tor]
    d.polygon(inner, fill=shirt)
    # collar
    cx0 = neck[0] + 1 * s * face
    d.polygon([(cx0 - 4 * s, neck[1] + 3 * s), (cx0 + 4 * s, neck[1] + 3 * s), (cx0 + 0.8 * s * face, neck[1] + 9 * s)], fill=_shade(shirt, 0.72))
    # cloth folds (armpit to waist, waist crease)
    fc = _shade(shirt, 0.8)
    a0 = tp(0.25, -w_sh * 0.55 * face); a1 = tp(0.55, -w_hip * 0.1 * face)
    d.line([a0, ((a0[0] + a1[0]) / 2 + 2 * s * face, (a0[1] + a1[1]) / 2), a1], fill=fc, width=max(1, int(1.3 * s)), joint="curve")
    b0 = tp(0.78, w_hip * 0.6 * face); b1 = tp(0.86, w_hip * 0.05 * face)
    d.line([b0, b1], fill=fc, width=max(1, int(1.1 * s)))
    if vest:
        vv = [tp(0.04, -w_sh + 2.5 * s), tp(0.06, -2 * s * face if face > 0 else -w_sh + 2.5 * s), tp(0.97, -2 * s * face if face > 0 else -w_hip + 1.5 * s), tp(0.97, -w_hip + 1.5 * s)]
        vv = [tp(0.05, -(w_sh - 2.5 * s)), tp(0.05, -1.5 * s), tp(0.95, -1.5 * s), tp(0.95, -(w_hip - 0.5 * s))]
        vv2 = [(2 * neck[0] - x_ + 2 * s * face * 0 + (hip[0] - neck[0]) * 0, y_) for x_, y_ in vv]
        vv2 = [tp(0.05, (w_sh - 2.5 * s)), tp(0.05, 3 * s), tp(0.95, 2.5 * s), tp(0.95, (w_hip - 0.5 * s))]
        for poly, k in ((vv, 1.0), (vv2, 1.08)):
            d.polygon(_chaikin(poly, 2), fill=_shade(vest, k), outline=OUT)
    # belt
    d.rectangle([hip[0] - w_hip, hip[1] - 1 * s, hip[0] + w_hip, hip[1] + 3 * s], fill=_shade(pants, 0.6))

    # front leg (over torso bottom)
    kA = _ik((hip[0] + 2 * s * face, hip[1]), fA, leg_l1, leg_l2, face)
    _limb(d, (hip[0] + 2 * s * face, hip[1] + 1 * s), kA, fA, 9.5 * s, pants, ow)
    d.ellipse([fA[0] - (3 if face > 0 else 9) * s, fA[1] - 4 * s, fA[0] + (9 if face > 0 else 3) * s, fA[1] + 1 * s], fill=shoes, outline=OUT)

    # head (detailed v7)
    hc = (neck[0] + 2 * s * face, neck[1] - head_r + 1 * s)
    eye, m = _head(d, hc, head_r, s, face, look, pose.get("expr", "neutral"), t, skin, neck, ow, kid)

    # front arm + props
    expr = pose.get("expr", "neutral")
    prop = pose.get("prop")
    if expr == "shh":
        hand = (m[0] + 1 * s * face, m[1] - 1 * s)
        el = (shoulder[0] + 9 * s * face, shoulder[1] + 16 * s)
        _limb(d, shoulder, el, hand, 7.5 * s, shirt, ow)
        d.rounded_rectangle([hand[0] - 1.5 * s, hand[1] - 8 * s, hand[0] + 1.5 * s, hand[1] + 1 * s], radius=int(1.5 * s), fill=skin, outline=OUT)
    elif pose.get("gesture") in ("hug", "push", "pray", "cower", "point"):
        g = pose["gesture"]
        if g == "hug":      # arm wraps forward around someone in front, hand at their back
            el = (shoulder[0] + 13 * s * face, shoulder[1] + 9 * s); hand = (el[0] + 12 * s * face, el[1] - 2 * s)
        elif g == "push":   # both arms straight forward (pushing a stone)
            el = (shoulder[0] + 14 * s * face, shoulder[1] + 2 * s); hand = (el[0] + 13 * s * face, el[1] + 1 * s)
        elif g == "pray":
            el = (shoulder[0] + 8 * s * face, shoulder[1] + 16 * s); hand = (shoulder[0] + 11 * s * face, shoulder[1] + 4 * s)
        elif g == "cower":  # hands up near face
            el = (shoulder[0] + 10 * s * face, shoulder[1] + 2 * s); hand = (hc[0] + 9 * s * face, hc[1] + 2 * s)
        else:               # point forward and slightly up
            el = (shoulder[0] + 14 * s * face, shoulder[1] - 2 * s); hand = (el[0] + 14 * s * face, el[1] - 5 * s)
        _limb(d, shoulder, el, hand, 7.5 * s, shirt, ow)
        d.ellipse([hand[0] - 3 * s, hand[1] - 3 * s, hand[0] + 3 * s, hand[1] + 3 * s], fill=skin, outline=OUT)
        if g == "point":
            d.line([hand, (hand[0] + 6 * s * face, hand[1] - 2 * s)], fill=skin, width=int(2.4 * s))
    elif prop == "hammer":
        k = pose.get("hammer", 0.0)            # 0 raised .. 1 struck
        a = math.radians(-120 + 150 * k)
        el = (shoulder[0] + math.cos(a) * 14 * s * face, shoulder[1] + math.sin(a) * 14 * s)
        a2 = a + math.radians(25)
        hand = (el[0] + math.cos(a2) * 13 * s * face, el[1] + math.sin(a2) * 13 * s)
        _limb(d, shoulder, el, hand, 7.5 * s, shirt, ow)
        a3 = a2 + math.radians(-80)
        tip = (hand[0] + math.cos(a3) * 22 * s * face, hand[1] + math.sin(a3) * 22 * s)
        d.line([hand, tip], fill=OUT, width=int(5 * s))
        d.line([hand, tip], fill=(140, 98, 60), width=int(3 * s))
        hx, hy = tip
        d.rounded_rectangle([hx - 6 * s, hy - 4 * s, hx + 6 * s, hy + 4 * s], radius=int(1.5 * s), fill=(110, 112, 120), outline=OUT)
    else:
        if prop in ("lamp", "torch") or pose.get("arm_up"):
            up = pose.get("arm_up", 0.7 if prop else 0)
            el = (shoulder[0] + 12 * s * face, shoulder[1] + (12 - 10 * up) * s)
            hand = (el[0] + 9 * s * face, el[1] + (2 - 14 * up) * s)
        else:
            sw2 = math.sin(ph) * 0.55 if walk is not None else -0.1
            el = (shoulder[0] + math.sin(-sw2) * 15 * s * face, shoulder[1] + math.cos(sw2) * 15 * s)
            hand = (el[0] + math.sin(-sw2 * 1.3 + 0.35) * 13 * s * face, el[1] + math.cos(sw2 * 1.3) * 13 * s)
        _limb(d, shoulder, el, hand, 7.5 * s, shirt, ow)
        d.ellipse([hand[0] - 3 * s, hand[1] - 3 * s, hand[0] + 3 * s, hand[1] + 3 * s], fill=skin, outline=OUT)
        fl = 1 + 0.1 * math.sin(t * 19 + x * 0.013) + 0.05 * math.sin(t * 37)
        if prop == "lamp":
            lx, ly = hand[0], hand[1] + 4 * s
            d.line([hand, (lx, ly)], fill=OUT, width=max(1, int(1.2 * s)))
            d.rounded_rectangle([lx - 5 * s, ly, lx + 5 * s, ly + 11 * s], radius=int(2 * s), fill=(255, 214, 140), outline=OUT, width=max(1, int(1.4 * s)))
            d.rectangle([lx - 6 * s, ly + 10 * s, lx + 6 * s, ly + 13 * s], fill=(70, 54, 40))
            lights.append((lx, ly + 6 * s, 5 * s * fl, 95 * s * fl, (255, 205, 120)))
        if prop == "torch":
            tx, ty = hand[0], hand[1] - 22 * s
            d.line([(hand[0], hand[1] + 6 * s), (tx, ty)], fill=OUT, width=int(5 * s))
            d.line([(hand[0], hand[1] + 6 * s), (tx, ty)], fill=(120, 80, 44), width=int(3 * s))
            fh = 12 * s * fl
            d.polygon([(tx - 5 * s, ty), (tx + 5 * s, ty), (tx + math.sin(t * 13) * 2 * s, ty - fh)], fill=(255, 150, 40))
            d.polygon([(tx - 2.5 * s, ty), (tx + 2.5 * s, ty), (tx, ty - fh * 0.6)], fill=(255, 230, 120))
            lights.append((tx, ty - 5 * s, 8 * s * fl, 130 * s * fl, (255, 150, 60)))
    fx = pose.get("fx") or ()
    if "sweat" in fx:
        q = (t * 0.7) % 1.0
        sx_, sy_ = hc[0] + 1.2 * s * face, hc[1] - head_r * 0.82 + q * 6 * s
        d.polygon([(sx_, sy_ - 2 * s), (sx_ - 1.2 * s, sy_ + 1 * s), (sx_ + 1.2 * s, sy_ + 1 * s)], fill=(200, 230, 255))
        d.ellipse([sx_ - 1.2 * s, sy_, sx_ + 1.2 * s, sy_ + 2.2 * s], fill=(200, 230, 255), outline=(110, 150, 190))
    if "tears" in fx:
        q = (t * 0.5) % 1.0
        tx_, ty_ = eye[0] - 1 * s * face, eye[1] + 3 * s + q * 9 * s
        d.ellipse([tx_ - 1.4 * s, ty_ - 1.4 * s, tx_ + 1.4 * s, ty_ + 2.4 * s], fill=(170, 210, 250))
        d.line([(eye[0] - 1 * s * face, eye[1] + 3 * s), (tx_, ty_)], fill=(170, 210, 250, 160), width=max(1, int(1.2 * s)))
    if "breath" in fx:
        q = (t * 0.6) % 1.0
        bx_, by_ = m[0] + (4 + q * 10) * s * face, m[1] - q * 4 * s
        d.ellipse([bx_ - (2 + q * 4) * s, by_ - (1.5 + q * 3) * s, bx_ + (2 + q * 4) * s, by_ + (1.5 + q * 3) * s], fill=(235, 240, 245, int(120 * (1 - q))))
    return lights


LOOKS = {
    "farmer": dict(shirt=(214, 200, 172), vest=(118, 82, 54), pants=(70, 62, 56), cap=(74, 62, 54), mustache=True, hair_col=(60, 44, 32)),
    "woman": dict(shirt=(170, 70, 62), pants=(92, 60, 70), headscarf=(196, 160, 90)),
    "woman2": dict(shirt=(70, 104, 150), pants=(70, 60, 70), headscarf=(150, 70, 70)),
    "elder": dict(shirt=(150, 140, 120), vest=(90, 70, 52), pants=(60, 54, 50), beard=(225, 225, 220), cap=(110, 100, 90)),
    "boy": dict(shirt=(110, 150, 100), pants=(80, 70, 60), hair=(60, 40, 28)),
    "raider": dict(shirt=(120, 36, 32), vest=(60, 52, 48), pants=(50, 42, 40), helmet=(150, 150, 158), beard=(40, 30, 26)),
    "tourist": dict(shirt=(64, 138, 196), pants=(60, 70, 90), hair=(90, 60, 40)),
    "tourist2": dict(shirt=(230, 120, 90), pants=(200, 190, 170), hair=(220, 190, 120)),
    "modern": dict(shirt=(84, 106, 140), pants=(52, 56, 66), hair=(56, 40, 30)),
}


def _head(d, hc, head_r, s, face, look, expr, t, skin, neck, ow, kid=False):
    """Detailed 3/4-profile head. Returns (eye, mouth) anchor points."""
    hx, hy = hc
    fem = bool(look.get("headscarf") or look.get("long_hair"))
    shade = _shade(skin, 0.94)
    blush = (226, 150, 128)
    # neck
    d.polygon([(neck[0] - 3.2 * s, neck[1] - 4 * s), (neck[0] + 3.2 * s, neck[1] - 4 * s), (neck[0] + 3.6 * s, neck[1] + 4 * s), (neck[0] - 3.6 * s, neck[1] + 4 * s)],
              fill=_shade(skin, 0.84), outline=OUT)
    # back hair mass (long hair) behind head
    if look.get("long_hair"):
        lh = look["long_hair"]
        d.polygon([(hx - head_r * 1.0 * face, hy - head_r * 0.4), (hx - head_r * 1.25 * face, hy + head_r * 1.6),
                   (hx + head_r * 0.1 * face, hy + head_r * 1.4), (hx + head_r * 0.3 * face, hy)], fill=lh, outline=OUT)
    if look.get("headscarf"):
        sc0 = look["headscarf"]
        d.ellipse([hx - head_r * 1.25 - 2 * s * face, hy - head_r * 1.25, hx + head_r * 0.9 - 2 * s * face, hy + head_r * 1.25], fill=sc0, outline=OUT)
        d.polygon([(hx - head_r * 0.8 * face, hy + 2 * s), (hx - head_r * 1.45 * face, hy + head_r * 2.0),
                   (hx + head_r * 0.1 * face, hy + head_r * 1.5)], fill=_shade(sc0, 0.86), outline=OUT)
    # skull + jaw: ellipse + chin polygon
    d.ellipse([hx - head_r, hy - head_r * 1.08, hx + head_r, hy + head_r * 0.92], fill=skin, outline=OUT, width=int(ow))
    chin = [(hx - head_r * 0.35 * face, hy + head_r * 0.55), (hx + head_r * 0.62 * face, hy + head_r * 0.62),
            (hx + head_r * 0.55 * face, hy + head_r * 1.02), (hx + head_r * 0.05 * face, hy + head_r * 1.12)]
    d.polygon(chin, fill=skin, outline=OUT)
    d.polygon([(chin[0][0] + 0.8 * s * face, chin[0][1] - 1 * s), (chin[1][0] - 0.5 * s * face, chin[1][1] - 0.6 * s),
               (chin[2][0] - 0.8 * s * face, chin[2][1] - 0.6 * s), (chin[3][0], chin[3][1] - 1 * s)], fill=skin)
    # face shading: back half darker
    d.chord([hx - head_r, hy - head_r * 1.08, hx + head_r, hy + head_r * 0.92], 110 if face > 0 else 290, 250 if face > 0 else 430, fill=shade)
    # ear
    ex_ = hx - 2.2 * s * face
    d.ellipse([ex_ - 2.8 * s, hy - 1.5 * s, ex_ + 2.8 * s, hy + 4.5 * s], fill=_shade(skin, 0.92), outline=OUT)
    d.arc([ex_ - 1.4 * s, hy - 0.3 * s, ex_ + 1.4 * s, hy + 3.2 * s], 300 if face > 0 else 60, 120 if face > 0 else 240, fill=_shade(skin, 0.7), width=max(1, int(0.9 * s)))
    # cheek blush
    cx_ = hx + 5.5 * s * face
    d.ellipse([cx_ - 2 * s, hy + 3.6 * s, cx_ + 2 * s, hy + 5.6 * s], fill=blush)
    # elder wrinkles / stubble
    if look.get("beard") and look["beard"][0] > 200:
        for k in range(3):
            d.arc([hx - 2 * s + 4 * s * face, hy - head_r * 0.85 + k * 2 * s, hx + 6 * s + 4 * s * face, hy - head_r * 0.6 + k * 2 * s], 200, 340, fill=_shade(skin, 0.75), width=max(1, int(0.8 * s)))
    if look.get("mustache") or look.get("stubble"):
        for k in range(28):
            u = (k * 0.618) % 1; v = (k * 0.381) % 1
            px = hx + (2 + u * 8) * s * face; py = hy + (5 + v * 6) * s
            d.ellipse([px - 0.35 * s, py - 0.35 * s, px + 0.35 * s, py + 0.35 * s], fill=_shade(skin, 0.7))
    # eyes
    blink = (t % 3.3) < 0.11
    wide = expr in ("surprised", "scared")
    eye = (hx + 5.2 * s * face, hy - 1.2 * s)
    ew, eh = 3.1 * s, (2.6 if not wide else 3.4) * s
    if blink:
        d.arc([eye[0] - ew, eye[1] - eh, eye[0] + ew, eye[1] + eh], 20, 160, fill=OUT, width=max(1, int(1.4 * s)))
    else:
        d.ellipse([eye[0] - ew, eye[1] - eh, eye[0] + ew, eye[1] + eh], fill=(252, 250, 245), outline=OUT, width=max(1, int(0.9 * s)))
        iris = look.get("eyes", (96, 66, 40))
        ir = 1.9 * s * (0.85 if wide else 1)
        ix = eye[0] + 0.9 * s * face
        d.ellipse([ix - ir, eye[1] - ir + 0.2 * s, ix + ir, eye[1] + ir + 0.2 * s], fill=iris)
        d.ellipse([ix - ir * 0.5, eye[1] - ir * 0.5 + 0.2 * s, ix + ir * 0.5, eye[1] + ir * 0.5 + 0.2 * s], fill=(18, 14, 12))
        d.ellipse([ix - ir * 0.7 + 0.8 * s, eye[1] - ir * 0.8, ix - ir * 0.7 + 1.6 * s, eye[1] - ir * 0.8 + 0.8 * s], fill=(255, 255, 255))
        # upper lid
        lid = {"angry": 0.45, "sad": 0.35, "neutral": 0.15, "talk": 0.15, "smile": 0.2}.get(expr, 0.0)
        if lid > 0:
            d.chord([eye[0] - ew, eye[1] - eh, eye[0] + ew, eye[1] + eh], 180, 360, fill=_shade(skin, 0.85))
            d.rectangle([eye[0] - ew, eye[1] - eh * (1 - lid * 2), eye[0] + ew, eye[1] - eh * (1 - lid * 2) + 0.01], fill=OUT)
        d.arc([eye[0] - ew, eye[1] - eh, eye[0] + ew, eye[1] + eh], 190, 350, fill=OUT, width=max(1, int(1.5 * s)))
        if fem:
            for k in (-1, 0, 1):
                bx_ = eye[0] + (k * 1.4 + 1.6 * face) * s
                d.line([(bx_, eye[1] - eh * 0.9), (bx_ + 0.9 * s * face, eye[1] - eh * 1.4)], fill=OUT, width=max(1, int(0.8 * s)))
    # eyebrow (shaped)
    by = eye[1] - 4.8 * s + {"surprised": -2.2, "scared": -1.6, "angry": 1.0, "smile": -0.4, "sad": -0.8}.get(expr, 0) * s
    tilt = {"angry": 1.8, "scared": -1.4, "sad": -1.6}.get(expr, 0) * s
    bc = look.get("hair_col") or look.get("hair") or (60, 44, 32)
    bw_ = 1.1 * s if not fem else 0.8 * s
    d.polygon([(eye[0] - 3.8 * s * face, by - tilt * face * 0 - tilt), (eye[0] + 3.6 * s * face, by + tilt),
               (eye[0] + 3.6 * s * face, by + tilt + bw_), (eye[0] - 3.8 * s * face, by - tilt + bw_ * 1.6)], fill=bc if isinstance(bc, tuple) else (60, 44, 32))
    # nose (profile) with nostril
    nb = (hx + 8.2 * s * face, hy - 1.5 * s)
    tip = (hx + 11.4 * s * face, hy + 2.6 * s)
    base = (hx + 8.4 * s * face, hy + 4.0 * s)
    d.polygon([nb, tip, base], fill=_shade(skin, 0.95), outline=OUT)
    d.arc([base[0] - 1.6 * s, base[1] - 2.2 * s, base[0] + 1.6 * s, base[1] + 0.4 * s], 0, 180, fill=_shade(skin, 0.65), width=max(1, int(0.8 * s)))
    # mouth with expression / visemes
    m = (hx + 6.6 * s * face, hy + 7.0 * s)
    lip = (178, 92, 86) if fem else _shade(skin, 0.7)
    vis = int(t * 11) % 4 if expr == "talk" else -1
    if expr in ("surprised", "scared") or vis in (0, 2):
        oh = (2.8 if expr in ("surprised", "scared") else (1.8 if vis == 0 else 1.2)) * s
        d.ellipse([m[0] - 2.2 * s, m[1] - oh * 0.5, m[0] + 2.2 * s, m[1] + oh], fill=(90, 32, 30), outline=OUT, width=max(1, int(0.9 * s)))
        d.rectangle([m[0] - 1.6 * s, m[1] - oh * 0.45, m[0] + 1.6 * s, m[1] - oh * 0.15], fill=(245, 242, 235))
    elif expr == "smile":
        d.chord([m[0] - 3.2 * s, m[1] - 2.2 * s, m[0] + 3.2 * s, m[1] + 2.4 * s], 0, 180, fill=(90, 32, 30), outline=OUT)
        d.rectangle([m[0] - 2.6 * s, m[1] + 0.1 * s, m[0] + 2.6 * s, m[1] + 0.9 * s], fill=(245, 242, 235))
    elif expr in ("angry", "sad"):
        d.arc([m[0] - 3 * s, m[1] + 0.2 * s, m[0] + 3 * s, m[1] + 4 * s], 200, 340, fill=OUT, width=max(1, int(1.3 * s)))
    else:
        d.line([(m[0] - 2.4 * s, m[1] + 0.2 * s), (m[0] + 2.4 * s, m[1])], fill=OUT, width=max(1, int(1.2 * s)))
        d.line([(m[0] - 1.8 * s, m[1] + 1.2 * s), (m[0] + 1.6 * s, m[1] + 1.1 * s)], fill=lip, width=max(1, int(0.9 * s)))
    if look.get("mustache"):
        mc = look.get("hair_col", (64, 46, 34))
        d.polygon([(m[0] - 3.4 * s, m[1] - 1.0 * s), (m[0] - 0.5 * s, m[1] - 3.0 * s), (m[0] + 3.0 * s, m[1] - 2.6 * s),
                   (m[0] + 4.2 * s, m[1] - 0.6 * s), (m[0] + 0.5 * s, m[1] - 1.6 * s)], fill=mc, outline=OUT)
    if look.get("beard"):
        bcol = look["beard"]
        d.polygon([(hx - head_r * 0.25 * face, hy + head_r * 0.35), (hx + head_r * 0.35 * face, hy + head_r * 0.62),
                   (hx + head_r * 0.72 * face, hy + head_r * 0.58), (hx + head_r * 0.62 * face, hy + head_r * 1.15),
                   (hx + head_r * 0.1 * face, hy + head_r * 1.3), (hx - head_r * 0.35 * face, hy + head_r * 0.85)], fill=bcol, outline=OUT)
        d.ellipse([m[0] - 2 * s, m[1] - 1 * s, m[0] + 2 * s, m[1] + 1.4 * s], fill=(90, 32, 30))
    # hair / headwear on top
    if look.get("hair"):
        hair = look["hair"]
        d.chord([hx - head_r * 1.02, hy - head_r * 1.14, hx + head_r * 1.02, hy + head_r * 0.35], 180, 360, fill=hair, outline=OUT)
        d.polygon([(hx - head_r * 0.98 * face, hy - 4 * s), (hx - head_r * 0.15 * face, hy - head_r * 0.55),
                   (hx - head_r * 1.0 * face, hy + 5 * s)], fill=hair)
        d.polygon([(hx + head_r * 0.2 * face, hy - head_r * 0.95), (hx + head_r * 0.85 * face, hy - head_r * 0.55),
                   (hx + head_r * 0.45 * face, hy - head_r * 0.35)], fill=hair, outline=OUT)
        for k in range(5):
            x0 = hx + (-0.7 + k * 0.32) * head_r * face
            d.line([(x0, hy - head_r * 1.0), (x0 + 2 * s * face, hy - head_r * 0.62)], fill=_shade(hair, 0.75), width=max(1, int(0.8 * s)))
    if look.get("headscarf"):
        sc_ = look["headscarf"]
        d.chord([hx - head_r * 1.12, hy - head_r * 1.25, hx + head_r * 1.12, hy + head_r * 0.2], 180, 360, fill=sc_, outline=OUT)
        d.line([(hx - head_r * 1.05, hy - head_r * 0.52), (hx + head_r * 1.05, hy - head_r * 0.52)], fill=_shade(sc_, 0.8), width=max(1, int(1.2 * s)))
    if look.get("cap"):
        cp = look["cap"]
        d.chord([hx - head_r * 1.05, hy - head_r * 1.24, hx + head_r * 1.05, hy + head_r * 0.22], 180, 360, fill=cp, outline=OUT)
        d.line([(hx - head_r * 0.9, hy - head_r * 0.42), (hx + head_r * 0.9, hy - head_r * 0.42)], fill=_shade(cp, 0.7), width=max(1, int(1.2 * s)))
        bx0 = hx + (0 if face > 0 else -15 * s); bx1 = hx + (15 * s if face > 0 else 0)
        d.rounded_rectangle([min(bx0, bx1), hy - 5.2 * s, max(bx0, bx1), hy - 2.2 * s], radius=int(1.5 * s), fill=_shade(cp, 0.8), outline=OUT)
    if look.get("helmet"):
        hm = look["helmet"]
        d.chord([hx - head_r * 1.12, hy - head_r * 1.38, hx + head_r * 1.12, hy + head_r * 0.28], 180, 360, fill=hm, outline=OUT)
        d.line([(hx - head_r * 1.08, hy - head_r * 0.45), (hx + head_r * 1.08, hy - head_r * 0.45)], fill=_shade(hm, 0.6), width=max(1, int(1.4 * s)))
        d.rectangle([hx + 8.6 * s * face - 0.8 * s, hy - head_r * 0.45, hx + 8.6 * s * face + 0.8 * s, hy + 1.5 * s], fill=_shade(hm, 0.8), outline=OUT)
        d.polygon([(hx, hy - head_r * 1.55), (hx - 3 * s, hy - head_r * 1.12), (hx + 3 * s, hy - head_r * 1.12)], fill=(180, 40, 30), outline=OUT)
    return eye, m
