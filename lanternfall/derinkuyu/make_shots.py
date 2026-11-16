import json, os, re
def I(p, move="in", **k): return dict(img=f"real/{p}.jpg", move=move, **k)
def C(c, **k): return dict(clip=f"clips/{c}.mp4", tag="", **k)
def K(name, **k): return dict(card=name, **k)
L = {
0: [K("year", big="1963", small="Derinkuyu, central Türkiye", small2="A wall comes down")],
1: [C("c01")],
2: [C("c03")],
3: [C("c10")],
4: [K("section", title="At least 8 levels deep", upto=8)],
5: [C("c06")],
6: [I("p26", "out", label="DERINKUYU", sub="Nevşehir, Türkiye")],
7: [K("map", title="Cappadocia", sub="Central Anatolia")],
8: [I("e01", "right", label="VOLCANIC TUFF", sub="Ash from ancient eruptions"), I("p63", "left")],
9: [I("p31", "in")],
10: [I("p13", "left", label="THE LOCAL STORY")],
11: [C("c08")],
12: [I("p42", "right")],
13: [K("year", big="1969", small="Opened to visitors")],
14: [I("p46", "out")],
15: [K("section", title="Going down", upto=1, from_=0)],
16: [I("p04", "in", label="STABLES", sub="Closest to the light")],
17: [I("p16", "left", label="LIVING ROOMS")],
18: [I("p11", "in", label="KITCHENS")],
19: [I("p18", "right", label="PRESSES & STORES")],
20: [C("c05", label="WELLS")],
21: [I("p07", "out", label="MEETING HALLS")],
22: [I("p61", "in", label="THE CHAPEL?", sub="A cross-shaped room near the bottom")],
23: [K("section", upto=8, animate=False, hl=7, title="≈ 85 meters")],
24: [K("depth")],
25: [I("p51", "up"), I("p30", "down")],
26: [I("p28", "in")],
27: [I("p38", "left")],
28: [C("c04", max=2.2)],
29: [I("p29", "in", label="ROLLING STONE DOORS", sub="Hundreds of kilograms each")],
30: [K("door")],
31: [I("p58", "in")],
32: [I("p47", "up")],
33: [I("p55", "in")],
34: [K("section", shaft=True, upto=8, animate=False, title="Air from the surface")],
35: [I("p12", "in", label="SHAFTS & WELLS")],
36: [I("p09", "out")],
37: [K("timeline", hl=0, title="Who dug it?")],
38: [I("g02", "right", label="PHRYGIANS?", sub="8th–7th century BC")],
39: [I("x01", "in", label="XENOPHON", sub="Greek writer, c. 400 BC")],
40: [I("g04", "left", label="BYZANTINE ERA")],
41: [I("p37", "in")],
42: [I("p05", "right")],
43: [I("g01", "in"), I("k02", "left", label="KAYMAKLI")],
44: [K("map", static=True, tunnel=True, places=["Derinkuyu", "Kaymaklı"], hl=["Kaymaklı"], view=(34.45, 35.05, 38.31, 38.53))],
45: [I("k01", "in"), I("k03", "right")],
46: [I("p10", "in")],
47: [I("h02", "in", label="1923", sub="The population exchange"), I("h01", "out")],
48: [I("p50", "right")],
49: [I("p15", "in")],
50: [I("p17", "in")],
51: [I("g03", "left", label="UNESCO WORLD HERITAGE", sub="Since 1985")],
52: [C("c07")],
53: [I("p36", "in")],
54: [I("p22", "in")],
55: [C("c09")],
56: [I("p34", "in"), C("c02")],
57: [I("p43", "in")],
58: [I("p65", "out")],
}
CH = {7: "1. The Discovery", 15: "2. Going Down", 27: "3. Built for a Siege", 37: "4. Who Built It?", 46: "5. The Last People", 52: "6. Today"}
out = []
for i in range(59):
    vis = L[i]
    for v in vis:
        if "img" in v:
            cf = v["img"][:-4] + ".credit.txt"
            if os.path.exists(cf):
                c = json.load(open(cf)); a = re.sub(r"\s+", " ", c["author"])[:40]
                v["credit"] = f"Photo: {a} · {c['license']}"
        if "from_" in v: v["from"] = v.pop("from_")
        if v.get("tag") == "": v.pop("tag")
    s = {"line": i, "vis": vis}
    if i in CH: s["chapter"] = CH[i]
    if i in (6, 36, 45, 51, 57): s["gap"] = 1.0
    out.append(s)
json.dump(out, open("shots.json", "w"), ensure_ascii=False, indent=1)
miss = [v["img"] for s in out for v in s["vis"] if "img" in v and not os.path.exists(v["img"])]
print("missing:", miss)
