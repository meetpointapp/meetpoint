import json, os, re, shutil
exec(open("make_shots.py").read().split("CH = {")[0])   # reuse old mapping L + helpers I, C, K
OLD = L
OLD[56] = [I("p34", "in")]                    # c02 moves to new line 59
OLD[47] = [I("h02", "in", label="1923", sub="The population exchange")]   # h01 moves to new 85
OLD[0] = [K("year", big="1963", small="Derinkuyu, central Türkiye", small2="A wall comes down")]
NEW = {
6: [I("z02", "out", label="NOT A CASTLE")],
9: [I("v02", "right")],
10: [I("e02", "in", focus=[0.5, 0.2])],
13: [I("v01", "left")],
14: [I("u03", "in"), I("f02", "up", tag="Cave church, Göreme")],
15: [I("p02", "down")],
21: [K("year", big="MALAKOPEA", small="The town's old Greek name")],
23: [I("p23", "in")],
24: [K("year", big="13–15 °C", small="All year round, deep underground")],
26: [I("k04", "in", tag="Kaymaklı underground city")],
28: [I("p33", "left")],
29: [I("p41", "in")],
30: [I("o05", "in", label="LAMP NICHES", tag="Özkonak underground city")],
31: [I("p35", "in")],
33: [I("o02", "right", tag="Soot-black walls, Özkonak underground city")],
35: [I("z01", "right")],
38: [K("year", big="THE SCHOOL", small="A long vaulted hall on the second level")],
49: [I("s01", "in", tag="Byzantine manuscript, 12th–13th century")],
50: [I("p08", "in")],
53: [I("k06", "in", tag="Kaymaklı underground city")],
55: [K("year", big="50+", small="Ventilation shafts found")],
58: [I("q01", "in", tag="Kaymaklı underground city")],
59: [C("c02")],
63: [K("year", big="ANABASIS", small="Xenophon's account, Book IV", small2="Houses dug into the ground, animals living below")],
64: [K("timeline", hl=1, title="An ancient idea")],
66: [I("s02", "right", tag="Byzantines vs. Arabs, Skylitzes manuscript")],
67: [I("f01", "in", tag="Cave church fresco, Göreme")],
70: [I("q02", "in", tag="Kaymaklı underground city")],
71: [I("o03", "in", label="CUT BY HAND", sub="Tool marks still on the walls", tag="Özkonak underground city")],
72: [I("k07", "up", tag="Kaymaklı underground city")],
73: [I("q03", "left", tag="Kaymaklı underground city")],
74: [I("q04", "in", tag="Kaymaklı underground city")],
76: [K("year", big="200+", small="Underground settlements counted in Cappadocia"), I("o01", "in", tag="Özkonak underground city")],
79: [I("t01", "in", tag="Tatlarin underground city")],
80: [I("n02", "right", label="NEVŞEHİR", sub="2014"), I("n01", "in")],
81: [I("o06", "in", tag="Özkonak underground city")],
84: [I("m01", "in", tag="Old Greek mansion, Mustafapaşa")],
85: [I("h01", "out")],
86: [I("o04", "in", tag="Özkonak underground city")],
92: [I("k05", "in", tag="Kaymaklı underground city")],
93: [I("q05", "in", tag="Kaymaklı underground city")],
98: [I("u02", "right")],
}
s2 = json.load(open("script_v2.json"))
CH = {int(k): v for k, v in s2["chapters"].items()}
os.makedirs("../dk2/audio", exist_ok=True)
for d in ("real", "clips", "cards.py"):
    if not os.path.lexists(f"../dk2/{d}"): os.symlink(os.path.abspath(d), f"../dk2/{d}")
newi = 0; out = []
for i, n in enumerate(s2["lines"]):
    if "old" in n:
        vis = json.loads(json.dumps(OLD[n["old"]])); src = f"audio_s/line_{n['old']:02d}.wav"
    else:
        vis = NEW[i]; src = f"new/audio_s/line_{newi:02d}.wav"; newi += 1
    shutil.copy(src, f"../dk2/audio/line_{i:03d}.wav")
    for v in vis:
        if "img" in v:
            cf = v["img"][:-4] + ".credit.txt"
            if os.path.exists(cf):
                c = json.load(open(cf)); a = re.sub(r"\s+", " ", c["author"].replace("(talk)", "")).strip()[:40]
                v["credit"] = f"Photo: {a} · {c['license']}"
        if "from_" in v: v["from"] = v.pop("from_")
        if v.get("tag") == "": v.pop("tag")
    s = {"line": i, "vis": vis}
    if i in CH: s["chapter"] = CH[i]
    out.append(s)
for i in (7, 21, 43, 59, 81, 90, 98): out[i]["gap"] = 1.0
for i, g in ((2, 1.6), (50, 2.0), (99, 1.8), (57, 1.4), (89, 1.4)): out[i]["gap"] = g
import subprocess
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "9", "../dk2/audio/line_101.wav"])
out.append({"line": 101, "vis": [K("end")], "gap": 0.0})
json.dump(out, open("../dk2/shots.json", "w"), ensure_ascii=False, indent=1)
seen = {}
for s in out:
    for v in s["vis"]:
        k = v.get("img") or v.get("clip")
        if k: seen[k] = seen.get(k, 0) + 1
print("repeats:", {k: c for k, c in seen.items() if c > 1})
print("missing:", [k for k in seen if not os.path.exists(k)])
print("visuals:", sum(len(s["vis"]) for s in out))
