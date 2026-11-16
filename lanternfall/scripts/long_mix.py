#!/usr/bin/env python3
"""Mix narration (from out/timeline.json) + music with ducking, normalize to -14 LUFS, mux with video.
  long_mix.py <project_dir> [limit_seconds]"""
import sys, os, json, subprocess
import numpy as np
import soundfile as sf

SR = 44100


def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.float32)


def main(P, limit=None):
    tl = json.load(open(os.path.join(P, "out", "timeline.json")))
    total = tl["total"] if not limit else min(limit, tl["total"])
    n = int(total * SR)
    voice = np.zeros(n, np.float32)
    for start, path in tl["voice"]:
        a = int(start * SR)
        if a >= n: continue
        y = load(path)
        voice[a:a + len(y)] += y[:n - a]
    sf.write(os.path.join(P, "out", "voice.wav"), voice, SR)
    mus = os.path.join(P, "music.wav")
    out = os.path.join(P, "out", "final.mp4")
    # music ducked under voice (sidechain), voice slightly warmed/compressed
    fc = ("[1:a]highpass=f=70,acompressor=threshold=0.1:ratio=3:attack=5:release=120,"
          "equalizer=f=180:t=q:w=1:g=1.5,equalizer=f=3500:t=q:w=1:g=2,asplit=2[v][sc];"
          "[2:a]volume=0.55[m];"
          "[m][sc]sidechaincompress=threshold=0.02:ratio=8:attack=40:release=600[md];"
          "[v][md]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9[a]")
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", os.path.join(P, "out", "video_noaudio.mp4"),
           "-i", os.path.join(P, "out", "voice.wav"), "-i", mus, "-filter_complex", fc,
           "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
           "-t", f"{total:.2f}", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    print("final:", out)


if __name__ == "__main__":
    main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else None)
