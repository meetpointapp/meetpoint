#!/usr/bin/env python3
"""Derinkuyu theme: underground wind + cello drone (D) + hang-drum motif + low drums in siege part.
  music_dk.py out.wav total_seconds sections.json
sections.json = [[start_s, "calm"|"descent"|"siege"|"mystery"|"end"], ...]"""
import sys, json
import numpy as np
from scipy.signal import butter, sosfilt
import soundfile as sf

SR = 44100
rng = np.random.default_rng(7)


def lp(x, f):
    return sosfilt(butter(2, f, "low", fs=SR, output="sos"), x)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def note(f, dur, kind="hang"):
    t = np.arange(int(dur * SR)) / SR
    if kind == "hang":
        y = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.0 * f * t) * np.exp(-t * 3)
             + 0.18 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 5))
        y *= np.exp(-t * 1.6) * (1 - np.exp(-t * 400))
    else:  # drum
        fr = f * (1 + 1.5 * np.exp(-t * 30))
        y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 6)
        y += lp(rng.standard_normal(len(t)), 800) * np.exp(-t * 25) * 0.4
    return y


def main(out, total, secs):
    n = int(total * SR)
    t = np.arange(n) / SR
    # intensity envelopes per section kind
    lvl = {"calm": (1, .6, 0, .2), "descent": (1, .9, 0, .35), "siege": (.8, 1, 1, .5),
           "mystery": (1, .7, .2, .25), "end": (.9, .9, 0, .3)}  # wind, drone, drum, hang density
    env = np.zeros((4, n))
    secs = secs + [[total, secs[-1][1]]]
    for (s, k), (e, _) in zip(secs[:-1], secs[1:]):
        a, b = int(s * SR), int(e * SR)
        env[:, a:b] = np.array(lvl[k])[:, None]
    k = int(3 * SR)  # smooth transitions (3 s)
    env = np.array([np.convolve(e, np.ones(k) / k, "same") for e in env])

    wind = bp(rng.standard_normal(n), 120, 900)
    wind *= 0.5 + 0.5 * np.sin(2 * np.pi * t / 11 + 1) ** 2
    wind = wind / np.abs(wind).max() * 0.18

    drone = np.zeros(n)
    for f, a in [(73.42, 1), (110.0, .5), (146.83, .25)]:  # D2, A2, D3
        vib = 1 + 0.003 * np.sin(2 * np.pi * 4.8 * t)
        ph = 2 * np.pi * np.cumsum(f * vib) / SR
        saw = sum(np.sin(h * ph) / h for h in range(1, 9))
        drone += a * saw
    drone = lp(drone, 900)
    drone *= 0.75 + 0.25 * np.sin(2 * np.pi * t / 23) ** 2
    drone = drone / np.abs(drone).max() * 0.22

    mel = np.zeros(n)
    scale = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33]  # D F G A C D (minor pentatonic)
    motif = [0, 2, 3, 1, 0, 4, 3, 2]
    pos, i = 0.5, 0
    while pos < total - 3:
        dens = env[3, int(pos * SR)]
        if rng.random() < dens * 2.2:
            y = note(scale[motif[i % 8]] / (2 if i % 16 >= 8 else 1), 3.5) * 0.12
            a = int(pos * SR); mel[a:a + len(y)] += y[:n - a]
            i += 1
        pos += 0.75
    drum = np.zeros(n)
    pos = 0
    while pos < total - 2:
        if env[2, int(pos * SR)] > 0.2:
            for off, g in [(0, 1), (0.42, .45)]:
                y = note(55, 1.2, "drum") * 0.35 * g
                a = int((pos + off) * SR); drum[a:a + len(y)] += y[:n - a]
        pos += 1.6
    mix = wind * env[0] + drone * env[1] + drum * env[2] + mel
    # simple stereo: delay copy
    d = int(0.017 * SR)
    L = mix; R = np.concatenate([np.zeros(d), mix[:-d]])
    rev = lp(np.concatenate([np.zeros(int(.09 * SR)), mix[:-int(.09 * SR)]]), 2500) * 0.25
    st = np.stack([L + rev, R + rev], 1)
    fade = int(4 * SR)
    st[:fade] *= np.linspace(0, 1, fade)[:, None]; st[-fade:] *= np.linspace(1, 0, fade)[:, None]
    st = st / np.abs(st).max() * 0.8
    sf.write(out, st.astype(np.float32), SR)


if __name__ == "__main__":
    main(sys.argv[1], float(sys.argv[2]), json.load(open(sys.argv[3])))
