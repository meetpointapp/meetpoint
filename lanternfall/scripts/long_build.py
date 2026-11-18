#!/usr/bin/env python3
"""16:9 long-video builder (v2: smooth sub-pixel camera, no rotation/jitter, crossfades, no repeats).
  long_build.py <project_dir>
project_dir/
  shots.json   [{"line": i, "chapter": "opt title", "gap": 0.45, "vis": [VIS, ...]}, ...]
     VIS = {"img": "real/p01.jpg", "move": "in|out|left|right|up|down", "credit": "..."}
         | {"clip": "clips/c01.mp4"}
         | {"card": "name", ...}  (rendered by cards.py: make(name, spec, t, dur) -> PIL RGB 1920x1080)
         optional "label": "big lower-third text", "tag": "RECONSTRUCTION"
  audio/line_NN.wav (or .mp3)  — narration lines
  music.wav (optional)
Outputs project_dir/out/video_noaudio.mp4, voice.wav, final.mp4, timeline.json"""
import sys, os, json, subprocess, math, glob, functools, importlib.util
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from multiprocessing import Pool

W, H, FPS = 1920, 1080, 30
XF = 0.6          # crossfade seconds
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts")
P = None          # project dir (set in main / worker init)
SHOTS = None
CARDS = None


@functools.lru_cache(maxsize=64)
def font(name, size, wght=None):
    f = ImageFont.truetype(os.path.join(FONTS, name), size)
    if wght:
        try:
            f.set_variation_by_axes([wght] if name.startswith("Cinzel") else [14, wght][-len(f.get_variation_axes()):])
        except Exception:
            pass
    return f


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def dur_of(p):
    return float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                                capture_output=True, text=True).stdout)


# ---------------- sources ----------------
@functools.lru_cache(maxsize=6)
def load_src(path):
    im = Image.open(os.path.join(P, path)).convert("RGB")
    w, h = im.size
    s = max(W * 1.18 / w, H * 1.18 / h)   # cover with 18% headroom for motion
    if s > 1:
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    else:
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    return im


def render_img(v, u):
    """u in [0,1] progress within shot. Sub-pixel affine, no rotation."""
    im = load_src(v["img"])
    sw, sh = im.size
    base = max(W / sw, H / sh)           # scale so the image just covers the frame
    mv = v.get("move", "in")
    e = ease(u) * 0.85 + u * 0.15        # mostly eased, never fully stopped
    z0, z1 = 1.0, 1.0
    if mv == "in": z0, z1 = 1.0, 1.12
    elif mv == "out": z0, z1 = 1.12, 1.0
    else: z0 = z1 = 1.08
    z = z0 + (z1 - z0) * e
    scale = base * z                      # output px per source px
    vw, vh = W / scale, H / scale         # visible window in source px
    fx, fy = v.get("focus", [0.5, 0.5])
    cx, cy = fx * sw, fy * sh
    span_x, span_y = (sw - vw) / 2, (sh - vh) / 2
    d = {"left": (1, 0), "right": (-1, 0), "up": (0, 1), "down": (0, -1)}.get(mv, (0, 0))
    cx += d[0] * span_x * 0.8 * (0.5 - e) * 2 * -1
    cy += d[1] * span_y * 0.8 * (0.5 - e) * 2 * -1
    cx = min(max(cx, vw / 2), sw - vw / 2)
    cy = min(max(cy, vh / 2), sh - vh / 2)
    x0, y0 = cx - vw / 2, cy - vh / 2
    return im.transform((W, H), Image.AFFINE, (1 / scale, 0, x0, 0, 1 / scale, y0), resample=Image.BICUBIC)


def clip_frames_dir(v, need):
    """Pre-render clip once: 1920x1080, 30 fps, stretched to `need` seconds with motion interpolation."""
    src = os.path.join(P, v["clip"])
    key = os.path.splitext(os.path.basename(src))[0] + f"_{need:.2f}"
    d = os.path.join(P, "cache", key)
    if os.path.isdir(d) and len(os.listdir(d)) >= int(need * FPS) - 1:
        return d
    os.makedirs(d, exist_ok=True)
    sd = dur_of(src)
    trim = v.get("max")                   # use only the first N seconds (avoid morphing tail)
    if trim: sd = min(sd, trim)
    f = max(need / sd, 0.5)
    vf = (f"trim=0:{sd},setpts=PTS-STARTPTS,setpts={f:.4f}*PTS,minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:vsbmc=1,"
          f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},"
          f"unsharp=5:5:0.6,eq=contrast=1.04:saturation=1.03")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf, "-frames:v", str(int(need * FPS) + 2),
                    "-q:v", "2", os.path.join(d, "f%05d.jpg")], check=True)
    return d


def render_clip(v, u, need):
    d = v["_dir"]
    n = len(os.listdir(d))
    i = min(int(u * need * FPS), n - 1)
    return Image.open(os.path.join(d, f"f{i + 1:05d}.jpg")).convert("RGB")


def render_vis(v, u, need):
    if "img" in v: fr = render_img(v, u)
    elif "clip" in v: fr = render_clip(v, u, need)
    else: fr = CARDS.make(v["card"], v, u * need, need, P)
    return overlay(fr, v, u * need, need)


# ---------------- overlays ----------------
def shadow_text(img, xy, text, f, fill=(255, 255, 255), alpha=1.0, anchor="la", glow=6):
    if alpha <= 0: return
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    d.text(xy, text, font=f, fill=(0, 0, 0, int(200 * alpha)), anchor=anchor)
    lay = lay.filter(ImageFilter.GaussianBlur(glow))
    d = ImageDraw.Draw(lay)
    d.text(xy, text, font=f, fill=fill + (int(255 * alpha),), anchor=anchor)
    img.paste(lay, (0, 0), lay)


def overlay(fr, v, t, need):
    a_in = ease(t / 0.6) * ease((need - t) / 0.6)
    if v.get("tag"):
        shadow_text(fr, (W - 48, 44), v["tag"], font("Inter.ttf", 26, 600), (255, 205, 130), 0.85, "ra", 3)
    if v.get("credit"):
        shadow_text(fr, (W - 40, H - 34), v["credit"], font("Inter.ttf", 20, 400), (230, 230, 230), 0.7, "rs", 2)
    if v.get("label"):
        a = ease((t - 0.3) / 0.7) * ease((need - t - 0.2) / 0.5)
        f = font("Cinzel.ttf", 64, 700)
        shadow_text(fr, (96, H - 140), v["label"], f, (255, 230, 190), a, "ls", 10)
        if v.get("sub"):
            shadow_text(fr, (100, H - 92), v["sub"], font("Inter.ttf", 30, 500), (235, 235, 235), a, "ls", 6)
    return fr


def chapter_overlay(fr, title, t):
    a = ease(t / 0.8) * ease((3.4 - t) / 0.8)
    if a <= 0: return fr
    lay = Image.new("RGBA", fr.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for y in range(H // 2, H):            # bottom gradient for legibility
        d.line([(0, y), (W, y)], fill=(0, 0, 0, int(150 * a * ((y - H / 2) / (H / 2)) ** 1.5)))
    fr.paste(lay, (0, 0), lay)
    num, _, name = title.partition(". ")
    shadow_text(fr, (96, H - 210), f"CHAPTER {num}", font("Inter.ttf", 30, 600), (255, 178, 72), a, "ls", 4)
    shadow_text(fr, (92, H - 120), name.upper(), font("Cinzel.ttf", 92, 700), (255, 255, 255), a, "ls", 12)
    d = ImageDraw.Draw(fr)
    d.line([(96, H - 196 + 10), (96 + int(260 * ease(t / 1.2)), H - 196 + 10)], fill=(255, 178, 72), width=3)
    return fr


VIGN = None


def vignette():
    global VIGN
    if VIGN is None:
        y, x = np.ogrid[:H, :W]
        r = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
        VIGN = (1 - 0.28 * np.clip(r - 0.55, 0, 1) ** 1.6)[..., None].astype(np.float32)
    return VIGN


# ---------------- timeline ----------------
def build_timeline():
    segs, chapters = [], []
    cur = 0.6
    voice = []
    for s in SHOTS:
        ad = os.path.join(P, os.environ.get("AUDIO", "audio"))
        a = next(os.path.join(ad, f"line_{s['line']:{w}}.{e}") for w in ("03d", "02d") for e in ("wav", "mp3")
                 if os.path.exists(os.path.join(ad, f"line_{s['line']:{w}}.{e}")))
        d = dur_of(a)
        if s.get("chapter"):
            cur += float(os.environ.get("CHPAUSE", 0.7))
            chapters.append((cur, s["chapter"]))
        gap = s.get("gap", 0.6)
        start, end = cur, cur + d + gap
        voice.append((start, a))
        n = len(s["vis"])
        # split by weights
        wts = [v.get("w", 1) for v in s["vis"]]
        acc = start
        for v, w in zip(s["vis"], wts):
            seg_d = (end - start) * w / sum(wts)
            segs.append({"v": v, "t0": acc, "t1": acc + seg_d})
            acc += seg_d
        cur = end
    total = cur + 2.5
    segs[-1]["t1"] = total
    segs[0]["t0"] = 0
    # extend each seg into the next for crossfade
    for a, b in zip(segs, segs[1:]):
        a["t1x"] = b["t0"] + XF
    segs[-1]["t1x"] = total
    return segs, chapters, voice, total


def worker_init(p, shots_):
    global P, SHOTS, CARDS
    P, SHOTS = p, shots_
    spec = importlib.util.spec_from_file_location("cards", os.path.join(P, "cards.py"))
    if os.path.exists(os.path.join(P, "cards.py")):
        CARDS = importlib.util.module_from_spec(spec); spec.loader.exec_module(CARDS)


def frame(args):
    t, segs, chapters, total = args
    act = [s for s in segs if s["t0"] <= t < s["t1x"]]
    out = None
    for s in act:
        need = s["t1x"] - s["t0"]
        u = (t - s["t0"]) / need
        fr = np.asarray(render_vis(s["v"], u, need), np.float32)
        if out is None:
            out = fr
        else:
            k = ease((t - s["t0"]) / XF)
            out = out * (1 - k) + fr * k
    if out is None:
        out = np.zeros((H, W, 3), np.float32)
    out = out * vignette()
    # global fade in/out
    g = min(1.0, 1.0 if os.environ.get("NOFADEIN") else t / 0.8, 1.0 if os.environ.get("NOFADEOUT") else (total - t) / 1.5)
    out *= max(g, 0)
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    for ct, title in chapters:
        if ct <= t < ct + 3.4:
            img = chapter_overlay(img, title, t - ct)
    return img.tobytes()


def main(p):
    global P, SHOTS
    P = os.path.abspath(p)
    SHOTS = json.load(open(os.path.join(P, "shots.json")))
    os.makedirs(os.path.join(P, "out"), exist_ok=True)
    segs, chapters, voice, total = build_timeline()
    # check no repeated image/clip
    seen = {}
    for s in segs:
        k = s["v"].get("img") or s["v"].get("clip")
        if k:
            if k in seen: print("WARNING repeat:", k)
            seen[k] = 1
    for s in segs:
        if "clip" in s["v"]:
            s["v"]["_dir"] = clip_frames_dir(s["v"], s["t1x"] - s["t0"])
    json.dump({"total": total, "chapters": chapters, "voice": voice,
               "segs": [{k: v for k, v in s.items() if k != "v"} | {"vis": {k: v for k, v in s["v"].items() if k != "_dir"}}
                        for s in segs]},
              open(os.path.join(P, "out", "timeline.json"), "w"), indent=1)
    lim = float(os.environ.get("LIMIT", total))
    nfr = int(min(total, lim) * FPS)
    t_start = float(os.environ.get("START", 0))
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "15",
                            "-tune", "film", "-pix_fmt", "yuv420p", "-x264-params", "keyint=60",
                            os.path.join(P, "out", "video_noaudio.mp4")], stdin=subprocess.PIPE)
    jobs = ((t_start + i / FPS, segs, chapters, total) for i in range(nfr))
    with Pool(4, initializer=worker_init, initargs=(P, SHOTS)) as pool:
        for i, b in enumerate(pool.imap(frame, jobs, chunksize=8)):
            enc.stdin.write(b)
            if i % 600 == 0: print(f"frame {i}/{nfr}", flush=True)
    enc.stdin.close(); enc.wait()
    print("video done", total)


if __name__ == "__main__":
    main(sys.argv[1])
