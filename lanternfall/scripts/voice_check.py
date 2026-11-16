#!/usr/bin/env python3
"""Whisper check of audio lines.  voice_check.py <audio_dir> <lang en|tr> [threshold]
Compares each line_NN.mp3 with the text in line_NN.json; prints score, flags bad lines."""
import sys, os, json, glob, re, subprocess, difflib
import numpy as np
from faster_whisper import WhisperModel

NUM = re.compile(r"\d+")


def norm(s):
    s = s.lower().replace("’", "").replace("'", "")
    s = re.sub(r"[^\w\s]", " ", s)
    return [w for w in s.split() if not NUM.fullmatch(w)]


def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", p, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def main(d, lang, thr=0.85):
    m = WhisperModel("small", device="cpu", compute_type="int8")
    bad = []
    for mp3 in sorted(glob.glob(os.path.join(d, "line_*.mp3"))):
        txt = json.load(open(mp3[:-4] + ".json"))["text"]
        segs, _ = m.transcribe(load(mp3), language=lang, beam_size=5)
        heard = " ".join(s.text for s in segs)
        a, b = norm(txt), norm(heard)
        sc = difflib.SequenceMatcher(None, a, b).ratio()
        flag = "" if sc >= thr else "  <-- BAD"
        if flag:
            bad.append(os.path.basename(mp3))
        print(f"{os.path.basename(mp3)} {sc:.2f}{flag}\n   want: {txt}\n   got : {heard.strip()}" if flag
              else f"{os.path.basename(mp3)} {sc:.2f}")
    print("BAD:", bad)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 0.85)
