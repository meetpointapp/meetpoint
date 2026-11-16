#!/usr/bin/env python3
"""Wan 2.2 image-to-video on HF ZeroGPU Spaces (tokens are proxy-injected).
  wan_i2v.py <in.jpg> <out.mp4> "<prompt>" [duration]"""
import sys, shutil, os, tempfile
from PIL import Image
from gradio_client import Client, handle_file

NEG = ("static, blurry, distorted, morphing, extra limbs, deformed, text, watermark, "
       "low quality, jpeg artifacts, flicker, sudden cut")
SPACES = [
    ("zerogpu-aoti/wan2-2-fp8da-aoti-faster", "a"),
    ("r3gm/wan2-2-fp8da-aoti-preview", "b"),
    ("r3gm/wan2-2-fp8da-aoti-preview2", "c"),
]


def small(src):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    s = 832 / max(w, h)
    im = im.resize((int(w * s) // 16 * 16, int(h * s) // 16 * 16), Image.LANCZOS)
    p = tempfile.mktemp(suffix=".jpg")
    im.save(p, quality=95)
    return p


def run(src, out, prompt, dur=3.5):
    img = small(src)
    errs = []
    for space, kind in SPACES:
        try:
            c = Client(space, verbose=False)
            kw = dict(input_image=handle_file(img), prompt=prompt, steps=6, negative_prompt=NEG,
                      duration_seconds=dur, guidance_scale=1, guidance_scale_2=1, seed=42,
                      randomize_seed=True, api_name="/generate_video")
            if kind != "a":
                kw.update(last_image=None, quality=6, scheduler="UniPCMultistep", flow_shift=3.0,
                          frame_multiplier="16", video_component=True, safe_mode=True,
                          enable_safety_checker=False)
            if kind == "c":
                kw.update(upscale_model="2xNomosUni_compact_otf_medium", upscale_factor=1.0)
            r = c.predict(**kw)
            v = r[0] if isinstance(r, (list, tuple)) else r
            if isinstance(v, dict):
                v = v.get("video") or v.get("path")
            shutil.copy(v, out)
            print("ok", space, out)
            return True
        except Exception as e:
            errs.append(f"{space}: {str(e)[:200]}")
    print("FAIL\n" + "\n".join(errs))
    return False


if __name__ == "__main__":
    ok = run(sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]) if len(sys.argv) > 4 else 3.5)
    sys.exit(0 if ok else 1)
