#!/usr/bin/env python3
"""Edge TTS (Brian) per line with word timings.
  voice_en.py <dir>   reads <dir>/lines_in.json  [[text, rate, pitch], ...]
  writes <dir>/audio/line_NN.mp3 + line_NN.json (words with start/end seconds)"""
import sys, os, json, asyncio, edge_tts

VOICE = "en-US-BrianMultilingualNeural"


async def one(text, rate, pitch, mp3, js):
    c = edge_tts.Communicate(text, VOICE, rate=rate, pitch=pitch, boundary="WordBoundary")
    words = []
    with open(mp3, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                s = ch["offset"] / 1e7
                words.append({"word": ch["text"], "start": s, "end": s + ch["duration"] / 1e7})
    json.dump({"text": text, "words": words}, open(js, "w"), ensure_ascii=False)


async def main(d, only=None):
    lines = json.load(open(os.path.join(d, "lines_in.json")))
    os.makedirs(os.path.join(d, "audio"), exist_ok=True)
    for i, l in enumerate(lines):
        if only and i not in only:
            continue
        text, rate, pitch = (l + ["+0%", "+0Hz"])[:3]
        b = os.path.join(d, "audio", f"line_{i:02d}")
        for t in range(4):
            try:
                await one(text, rate, pitch, b + ".mp3", b + ".json")
                break
            except Exception as e:
                print("retry", i, e); await asyncio.sleep(3)
        print("ok", i, text[:50])


if __name__ == "__main__":
    only = set(int(x) for x in sys.argv[2].split(",")) if len(sys.argv) > 2 else None
    asyncio.run(main(sys.argv[1], only))
