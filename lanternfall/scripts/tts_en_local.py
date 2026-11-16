#!/usr/bin/env python3
"""Local Chatterbox English narration with Whisper QA.
  cbenv/bin/python tts_en_local.py <dir> [ex] [cfg] [only=1,2]
reads <dir>/lines_in.json [[text, ...], ...] -> <dir>/audio/line_NN.wav (+ .json {text})"""
import sys, os, json, re, difflib, subprocess
import numpy as np, torch, torchaudio
from chatterbox.tts import ChatterboxTTS
from faster_whisper import WhisperModel

d = sys.argv[1]
ex = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
cfg = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
only = set(int(x) for x in sys.argv[4].split(",")) if len(sys.argv) > 4 else None
lines = json.load(open(os.path.join(d, "lines_in.json")))
os.makedirs(os.path.join(d, "audio"), exist_ok=True)
m = ChatterboxTTS.from_pretrained(device="cpu")
wm = WhisperModel("small", device="cpu", compute_type="int8")


def norm(s):
    s = re.sub(r"[^\w\s]", " ", s.lower().replace("'", ""))
    return [w for w in s.split() if not w.isdigit()]


def score(wav, text):
    a = torchaudio.functional.resample(wav, m.sr, 16000)[0].numpy().astype(np.float32)
    segs, _ = wm.transcribe(a, language="en", beam_size=5)
    heard = " ".join(x.text for x in segs)
    return difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio(), heard


for i, l in enumerate(lines):
    if only and i not in only: continue
    text = l[0]
    best = None
    for k in range(4):
        torch.manual_seed(100 + k)
        w = m.generate(text, exaggeration=ex, cfg_weight=cfg)
        sc, heard = score(w, text)
        if best is None or sc > best[0]: best = (sc, w, heard)
        if sc >= 0.93: break
    sc, w, heard = best
    out = os.path.join(d, "audio", f"line_{i:02d}")
    torchaudio.save(out + ".wav", w, m.sr)
    json.dump({"text": text, "score": sc, "heard": heard}, open(out + ".json", "w"))
    print(f"{i:02d} {sc:.2f} {'' if sc >= .9 else 'LOW: ' + heard}", flush=True)
print("TTSDONE")
