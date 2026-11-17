#!/usr/bin/env python3
"""Vertical 9:16 short builder on top of long_build (same smooth camera, crossfades, cards).
  short_build.py <project_dir>
project_dir: shots.json (same format as long_build) + audio/line_NNN.wav + optional music.wav + cards.py
  extra keys in project_dir/meta.json: {"headline": "...", "tag_ai": [...], "lang": "tr"|"en"}
Burns big word-by-word subtitles (faster-whisper word timings) and a top headline."""
import sys, os, json, subprocess, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import long_build as LB

W, H = 1080, 1920
LB.W, LB.H = W, H
SUBS = []          # [(t0, t1, text)]
META_DISPLAY = {}  # audio path -> display text
META = {}


@functools.lru_cache(maxsize=8)
def blurred_bg(key):
    im = Image.open(key).convert("RGB") if os.path.exists(key) else Image.new("RGB", (W, H), (20, 17, 13))
    w, h = im.size; s = max(W / w, H / h)
    im = im.resize((int(w * s) + 1, int(h * s) + 1)).crop((0, 0, W, H))
    return im.filter(ImageFilter.GaussianBlur(40)).point(lambda v: int(v * 0.45))


def letterbox(fr, bgkey):
    bg = blurred_bg(bgkey).copy()
    w, h = fr.size; s = W / w
    fr = fr.resize((W, int(h * s)), Image.LANCZOS)
    bg.paste(fr, (0, (H - fr.size[1]) // 2 - 80))
    return bg


_orig_render_vis = LB.render_vis


def render_vis(v, u, need):
    if "img" in v:
        fr = LB.render_img(v, u)
    elif "clip" in v and v.get("vert"):
        fr = LB.render_clip(v, u, need)
    elif "clip" in v:
        LB.W, LB.H = 1920, 1080
        try:
            fr = LB.render_clip(v, u, need)
        finally:
            LB.W, LB.H = W, H
        fr = letterbox(fr, os.path.join(LB.P, "bg.jpg"))
    else:
        LB.W, LB.H = 1920, 1080
        try:
            fr = LB.CARDS.make(v["card"], v, u * need, need, LB.P)
        finally:
            LB.W, LB.H = W, H
        if fr.size == (W, H):
            return overlay_v(fr, v, u * need, need)
        if v.get("crop"):
            fr = fr.crop((v["crop"][0], 0, v["crop"][1], fr.size[1]))
        fr = letterbox(fr, os.path.join(LB.P, "bg.jpg"))
    return overlay_v(fr, v, u * need, need)


def overlay_v(fr, v, t, need):
    if v.get("tag"):
        LB.shadow_text(fr, (W - 40, 440), v["tag"], LB.font("Inter.ttf", 30, 700), (255, 205, 130), 0.95, "ra", 3)
    if v.get("credit"):
        LB.shadow_text(fr, (W - 30, H - 40), v["credit"], LB.font("Inter.ttf", 20, 400), (230, 230, 230), 0.7, "rs", 2)
    if v.get("label"):
        a = LB.ease((t - 0.2) / 0.5) * LB.ease((need - t - 0.1) / 0.4)
        LB.shadow_text(fr, (W / 2, 1270), v["label"], LB.font("Cinzel.ttf", 64, 700), (255, 230, 190), a, "mm", 10)
    return fr


LB.render_vis = render_vis


def wrap(text, f, maxw):
    d = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) > maxw and cur:
            lines.append(cur); cur = w
        else:
            cur = t
    if cur: lines.append(cur)
    return lines


def draw_top(img, t):
    hl = META.get("headline")
    if not hl: return
    d = ImageDraw.Draw(img)
    f = LB.font("Inter.ttf", 66, 900)
    lines = wrap(hl, f, W - 120)
    y = 120
    for ln in lines:
        d.text((W / 2, y), ln, font=f, fill=(255, 255, 255), anchor="ma", stroke_width=8, stroke_fill=(0, 0, 0))
        y += 80
    d.text((W / 2, y + 6), META.get("brand", "LANTERNFALL"), font=LB.font("Inter.ttf", 26, 700), fill=(255, 178, 72),
           anchor="ma", stroke_width=4, stroke_fill=(0, 0, 0))


def draw_sub(img, t):
    for a, b, txt in SUBS:
        if a <= t < b:
            d = ImageDraw.Draw(img)
            f = LB.font("Inter.ttf", 78, 900)
            up = (txt.replace("i", "İ").replace("ı", "I") if META.get("lang") == "tr" else txt).upper()
            lines = wrap(up if META.get("upper", True) else txt, f, W - 140)
            y = 1430
            for ln in lines:
                d.text((W / 2, y), ln, font=f, fill=(255, 210, 90) if META.get("yellow", True) else (255, 255, 255),
                       anchor="ma", stroke_width=9, stroke_fill=(0, 0, 0))
                y += 92
            break


_orig_frame = LB.frame


def frame(args):
    b = _orig_frame(args)
    img = Image.frombytes("RGB", (W, H), b)
    draw_top(img, args[0]); draw_sub(img, args[0])
    return img.tobytes()


def worker_init(p, shots_, subs, meta):
    global SUBS, META
    LB.worker_init(p, shots_)
    LB.W, LB.H = W, H
    SUBS, META = subs, meta


def make_subs(P, voice, lang):
    from faster_whisper import WhisperModel
    m = WhisperModel("small", device="cpu", compute_type="int8")
    out = []
    for start, path in voice:
        if os.path.getsize(path) < 2000: continue
        raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                             capture_output=True).stdout
        a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
        segs, _ = m.transcribe(a, language=lang, word_timestamps=True)
        words = [w for s in segs for w in s.words]
        disp = META_DISPLAY.get(path)
        if disp and words:
            # spread display words over the spoken span, weighted by length (keeps names/numbers as written)
            t0, t1 = words[0].start, words[-1].end
            toks = disp.split(); tot = sum(len(x) + 1 for x in toks); acc = 0
            class Wd: pass
            words = []
            for x in toks:
                w = Wd(); w.word = x; w.start = t0 + (t1 - t0) * acc / tot; acc += len(x) + 1
                w.end = t0 + (t1 - t0) * acc / tot; words.append(w)
        i = 0
        while i < len(words):
            grp = words[i:i + 3]
            txt = " ".join(w.word.strip() for w in grp)
            out.append((start + grp[0].start, start + grp[-1].end + 0.05, txt))
            i += 3
    # extend each to next start for no flicker
    out.sort()
    res = []
    for k, (a, b, t) in enumerate(out):
        nxt = out[k + 1][0] if k + 1 < len(out) else b + 0.3
        res.append((a, min(max(b, a + 0.35), nxt), t))
    return res


def main(p):
    P = os.path.abspath(p)
    LB.P = P
    LB.SHOTS = json.load(open(os.path.join(P, "shots.json")))
    meta = json.load(open(os.path.join(P, "meta.json"))) if os.path.exists(os.path.join(P, "meta.json")) else {}
    os.makedirs(os.path.join(P, "out"), exist_ok=True)
    segs, chapters, voice, total = LB.build_timeline()
    total -= 1.5
    for s in segs:
        if "clip" in s["v"]:
            if not s["v"].get("vert"): LB.W, LB.H = 1920, 1080
            s["v"]["_dir"] = LB.clip_frames_dir(s["v"], s["t1x"] - s["t0"])
            LB.W, LB.H = W, H
    disp = meta.get("display")
    if disp:
        for (st, path), txt in zip(voice, disp):
            META_DISPLAY[path] = txt
    subs = make_subs(P, voice, meta.get("lang", "en"))
    json.dump({"total": total, "voice": voice, "subs": subs}, open(os.path.join(P, "out", "timeline.json"), "w"), indent=1)
    nfr = int(total * LB.FPS)
    from multiprocessing import Pool
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", str(LB.FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
                            "-pix_fmt", "yuv420p", os.path.join(P, "out", "video_noaudio.mp4")], stdin=subprocess.PIPE)
    jobs = ((i / LB.FPS, segs, [], total) for i in range(nfr))
    with Pool(4, initializer=worker_init, initargs=(P, LB.SHOTS, subs, meta)) as pool:
        for b in pool.imap(frame, jobs, chunksize=8):
            enc.stdin.write(b)
    enc.stdin.close(); enc.wait()
    print("video done", total)


if __name__ == "__main__":
    main(sys.argv[1])
