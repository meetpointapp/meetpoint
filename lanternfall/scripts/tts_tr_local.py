#!/usr/bin/env python3
"""Turkish narration: Chatterbox Multilingual cloned from Piper tr_TR-dfki reference ("1" setting).
  cbenv/bin/python tts_tr_local.py <dir> [only=1,2]
reads <dir>/lines_in.json [[text], ...] (years in words!) -> <dir>/audio_raw/line_NNN.wav -> <dir>/audio/line_NNN.wav (atempo 1.1)"""
import sys, os, json, re, difflib, subprocess
import numpy as np, torch, torchaudio
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from faster_whisper import WhisperModel
d = sys.argv[1]
only = set(int(x) for x in sys.argv[2].split(",")) if len(sys.argv) > 2 else None
REF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ref_tr.wav")
lines = json.load(open(os.path.join(d, "lines_in.json")))
for k in ("audio_raw", "audio"): os.makedirs(os.path.join(d, k), exist_ok=True)
m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
wm = WhisperModel("small", device="cpu", compute_type="int8")
def norm(s):
    s = re.sub(r"[^\w\s]", " ", s.lower().replace("'", "").replace("’", ""))
    return [w for w in s.split() if not w.isdigit()]
for i, l in enumerate(lines):
    if only and i not in only: continue
    text = l[0]; best = None
    for k in range(4):
        torch.manual_seed(10 + k)
        w = m.generate(text, language_id="tr", audio_prompt_path=REF, exaggeration=1.1, cfg_weight=0.3)
        a = torchaudio.functional.resample(w, m.sr, 16000)[0].numpy().astype(np.float32)
        segs, _ = wm.transcribe(a, language="tr", beam_size=5)
        heard = " ".join(x.text for x in segs)
        sc = difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio()
        if best is None or sc > best[0]: best = (sc, w, heard)
        if sc >= 0.93: break
    sc, w, heard = best
    raw = os.path.join(d, "audio_raw", f"line_{i:03d}.wav")
    torchaudio.save(raw, w, m.sr)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af",
                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo=1.1",
                    "-ar", "44100", os.path.join(d, "audio", f"line_{i:03d}.wav")])
    print(f"{i:02d} {sc:.2f} {'' if sc >= .9 else 'LOW: ' + heard}", flush=True)
print("TTSDONE")
