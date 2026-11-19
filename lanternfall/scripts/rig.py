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


def _limb(d, p0, p1, p2, w, col, ow):
    # outline pass then color pass for a two-segment limb
    d.line([p0, p1, p2], fill=OUT, width=int(w + 2 * ow), joint="curve")
    d.line([p0, p1, p2], fill=col, width=int(w), joint="curve")
    for p in (p0, p1, p2):
        r = w / 2
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=col)


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
    kid = pose.get("kid", False)
    s = s * (0.72 if kid else 1.0)
    ow = max(1.0, 2.2 * s)
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
    neck = (hip[0] + lean, hip[1] - torso_h)
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

    # torso (trapezoid with outline) + two-tone shading
    w_sh, w_hip = 15 * s, 12 * s
    tor = [(neck[0] - w_sh, neck[1] + 3 * s), (neck[0] + w_sh, neck[1] + 3 * s),
           (hip[0] + w_hip, hip[1] + 4 * s), (hip[0] - w_hip, hip[1] + 4 * s)]
    d.polygon(tor, fill=shirt, outline=OUT, width=int(ow))
    back = [(neck[0] - w_sh * face, neck[1] + 3 * s), (neck[0] - 3 * s * face, neck[1] + 3 * s),
            (hip[0] - 3 * s * face, hip[1] + 4 * s), (hip[0] - w_hip * face, hip[1] + 4 * s)]
    d.polygon(back, fill=_shade(shirt, 0.86))
    if vest:
        vv = [(neck[0] - w_sh + 2 * s, neck[1] + 4 * s), (neck[0] - 2 * s * face, neck[1] + 5 * s),
              (hip[0] - 2 * s * face, hip[1] + 3 * s), (hip[0] - w_hip + 1 * s, hip[1] + 3 * s)]
        vv2 = [(neck[0] + 4 * s * face, neck[1] + 5 * s), (neck[0] + w_sh - 2 * s, neck[1] + 4 * s),
               (hip[0] + w_hip - 1 * s, hip[1] + 3 * s), (hip[0] + 3 * s * face, hip[1] + 3 * s)]
        d.polygon(vv if face > 0 else vv2, fill=vest, outline=OUT)
        d.polygon(vv2 if face > 0 else vv, fill=_shade(vest, 1.08), outline=OUT)
    # belt
    d.rectangle([hip[0] - w_hip, hip[1] - 1 * s, hip[0] + w_hip, hip[1] + 3 * s], fill=_shade(pants, 0.6))

    # front leg (over torso bottom)
    kA = _ik((hip[0] + 2 * s * face, hip[1]), fA, leg_l1, leg_l2, face)
    _limb(d, (hip[0] + 2 * s * face, hip[1] + 1 * s), kA, fA, 9.5 * s, pants, ow)
    d.ellipse([fA[0] - (3 if face > 0 else 9) * s, fA[1] - 4 * s, fA[0] + (9 if face > 0 else 3) * s, fA[1] + 1 * s], fill=shoes, outline=OUT)

    # head
    hc = (neck[0] + 2 * s * face, neck[1] - head_r + 1 * s)
    d.rectangle([neck[0] - 3 * s, neck[1] - 3 * s, neck[0] + 3 * s, neck[1] + 4 * s], fill=_shade(skin, 0.9))
    d.ellipse([hc[0] - head_r, hc[1] - head_r * 1.08, hc[0] + head_r, hc[1] + head_r], fill=skin, outline=OUT, width=int(ow))
    # ear
    ex_ = hc[0] - 2.5 * s * face
    d.ellipse([ex_ - 2.6 * s, hc[1] - 1 * s, ex_ + 2.6 * s, hc[1] + 4 * s], fill=_shade(skin, 0.9), outline=OUT)
    if look.get("hair"):
        hair = look["hair"]
        d.chord([hc[0] - head_r, hc[1] - head_r * 1.1, hc[0] + head_r, hc[1] + head_r * 0.5], 180, 360, fill=hair, outline=OUT)
        d.polygon([(hc[0] - head_r * face, hc[1] - 3 * s), (hc[0] - head_r * 0.2 * face, hc[1] - head_r * 0.6),
                   (hc[0] - head_r * 1.05 * face, hc[1] + 6 * s)], fill=hair)
    if look.get("headscarf"):
        sc = look["headscarf"]
        d.ellipse([hc[0] - head_r * 1.15 - 1.5 * s * face, hc[1] - head_r * 1.25, hc[0] + head_r * 0.95 - 1.5 * s * face, hc[1] + head_r * 1.05], fill=sc, outline=OUT)
        d.polygon([(hc[0] - head_r * 0.9 * face, hc[1] + 2 * s), (hc[0] - head_r * 1.4 * face, hc[1] + head_r * 1.9),
                   (hc[0] - head_r * 0.1 * face, hc[1] + head_r * 1.3)], fill=_shade(sc, 0.88), outline=OUT)
        # face opening
        d.ellipse([hc[0] - head_r * 0.25 + 2 * s * face, hc[1] - head_r * 0.85, hc[0] + head_r * 0.95 + 1 * s * face, hc[1] + head_r * 0.9], fill=skin)
    if look.get("cap"):
        cp = look["cap"]
        d.chord([hc[0] - head_r * 1.04, hc[1] - head_r * 1.22, hc[0] + head_r * 1.04, hc[1] + head_r * 0.25], 180, 360, fill=cp, outline=OUT)
        bx0 = hc[0] + (0 if face > 0 else -15 * s); bx1 = hc[0] + (15 * s if face > 0 else 0)
        d.rounded_rectangle([min(bx0, bx1), hc[1] - 5 * s, max(bx0, bx1), hc[1] - 2 * s], radius=int(1.5 * s), fill=_shade(cp, 0.8), outline=OUT)
    if look.get("helmet"):
        hm = look["helmet"]
        d.chord([hc[0] - head_r * 1.1, hc[1] - head_r * 1.35, hc[0] + head_r * 1.1, hc[1] + head_r * 0.3], 180, 360, fill=hm, outline=OUT)
        d.polygon([(hc[0], hc[1] - head_r * 1.5), (hc[0] - 3 * s, hc[1] - head_r * 1.1), (hc[0] + 3 * s, hc[1] - head_r * 1.1)], fill=(180, 40, 30))
    # eye / brow / nose / mouth
    expr = pose.get("expr", "neutral")
    blink = (t % 3.3) < 0.11
    eye = (hc[0] + 5.5 * s * face, hc[1] - 1.5 * s)
    if blink:
        d.line([(eye[0] - 2.4 * s, eye[1]), (eye[0] + 2.4 * s, eye[1])], fill=OUT, width=max(1, int(1.6 * s)))
    else:
        er = 2.6 * s * (1.35 if expr in ("surprised", "scared") else 1)
        d.ellipse([eye[0] - er, eye[1] - er, eye[0] + er, eye[1] + er], fill=(250, 248, 240), outline=OUT, width=max(1, int(0.9 * s)))
        pr = 1.4 * s
        d.ellipse([eye[0] + 0.6 * s * face - pr, eye[1] - pr + 0.2 * s, eye[0] + 0.6 * s * face + pr, eye[1] + pr + 0.2 * s], fill=(28, 22, 18))
    br = {"surprised": -2.6, "scared": -2.0, "angry": 1.6, "smile": -0.6}.get(expr, 0) * s
    tilt = {"angry": 1.6, "scared": -1.2}.get(expr, 0) * s * face
    d.line([(eye[0] - 3.5 * s, eye[1] - 5 * s + br - tilt), (eye[0] + 3.5 * s, eye[1] - 5 * s + br + tilt)], fill=OUT, width=max(1, int(1.8 * s)))
    nose = (hc[0] + 10.5 * s * face, hc[1] + 2 * s)
    d.polygon([(hc[0] + 8 * s * face, hc[1] - 1 * s), nose, (hc[0] + 8 * s * face, hc[1] + 3.5 * s)], fill=_shade(skin, 0.88), outline=OUT)
    m = (hc[0] + 6.5 * s * face, hc[1] + 6.5 * s)
    talking = expr == "talk" and int(t * 10) % 2 == 0
    if expr in ("surprised", "scared") or talking:
        d.ellipse([m[0] - 2 * s, m[1] - 1.6 * s, m[0] + 2 * s, m[1] + 2.4 * s], fill=(96, 34, 30), outline=OUT)
    elif expr == "smile":
        d.arc([m[0] - 3 * s, m[1] - 3 * s, m[0] + 3 * s, m[1] + 1.5 * s], 20, 160, fill=OUT, width=max(1, int(1.5 * s)))
    elif expr == "angry":
        d.line([(m[0] - 2.5 * s, m[1] + 1 * s), (m[0] + 2.5 * s, m[1])], fill=OUT, width=max(1, int(1.5 * s)))
    else:
        d.line([(m[0] - 2.2 * s, m[1]), (m[0] + 2.2 * s, m[1])], fill=OUT, width=max(1, int(1.4 * s)))
    if look.get("mustache"):
        mc = look.get("hair_col", (64, 46, 34))
        d.rounded_rectangle([m[0] - 3.5 * s + 2 * s * face, m[1] - 3.2 * s, m[0] + 3.5 * s + 2 * s * face, m[1] - 1.0 * s], radius=int(1.2 * s), fill=mc)
    if look.get("beard"):
        bc = look["beard"]
        d.chord([hc[0] - head_r * 0.9, hc[1] - 2 * s, hc[0] + head_r * 1.0, hc[1] + head_r * 1.15], 0, 180, fill=bc, outline=OUT)
        d.ellipse([m[0] - 2.2 * s, m[1] - 1 * s, m[0] + 2.2 * s, m[1] + 1.6 * s], fill=(96, 34, 30))

    # front arm + props
    prop = pose.get("prop")
    if expr == "shh":
        hand = (m[0] + 1 * s * face, m[1] - 1 * s)
        el = (shoulder[0] + 9 * s * face, shoulder[1] + 16 * s)
        _limb(d, shoulder, el, hand, 7.5 * s, shirt, ow)
        d.rounded_rectangle([hand[0] - 1.5 * s, hand[1] - 8 * s, hand[0] + 1.5 * s, hand[1] + 1 * s], radius=int(1.5 * s), fill=skin, outline=OUT)
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
