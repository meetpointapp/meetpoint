#!/usr/bin/env python3
"""Wikimedia Commons helper.
  commons_get.py search "<query>" [n]
  commons_get.py get "File:Name.jpg" out.jpg [width]
Writes out.credit.txt (author / license / source url)."""
import sys, time, re, json, requests

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "LanternfallResearch/1.0 (educational video research)"}


def api(params, tries=6):
    params = dict(params, format="json")
    for i in range(tries):
        r = requests.get(API, params=params, headers=UA, timeout=60)
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/json"):
            return r.json()
        time.sleep(8 + 6 * i)
    raise SystemExit(f"api failed: {r.status_code}")


def search(q, n=30):
    d = api({"action": "query", "list": "search", "srsearch": q, "srnamespace": 6, "srlimit": n})
    for x in d["query"]["search"]:
        print(x["title"])


def strip(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()


def get(title, out, width=1920):
    d = api({"action": "query", "titles": title, "prop": "imageinfo",
             "iiprop": "url|extmetadata|size", "iiurlwidth": width})
    page = next(iter(d["query"]["pages"].values()))
    ii = page["imageinfo"][0]
    url = ii.get("thumburl") or ii["url"]
    if ii.get("width", 0) and ii["width"] <= width:
        url = ii["url"]
    for i in range(6):
        r = requests.get(url, headers=UA, timeout=120)
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/"):
            open(out, "wb").write(r.content)
            break
        time.sleep(10 + 8 * i)
    else:
        raise SystemExit(f"download failed {r.status_code} {url}")
    md = ii.get("extmetadata", {})
    credit = {
        "title": title,
        "author": strip(md.get("Artist", {}).get("value")),
        "license": strip(md.get("LicenseShortName", {}).get("value")),
        "source": ii.get("descriptionurl"),
    }
    open(re.sub(r"\.\w+$", "", out) + ".credit.txt", "w").write(json.dumps(credit, ensure_ascii=False))
    print("ok", out, credit["author"], credit["license"])


if __name__ == "__main__":
    if sys.argv[1] == "search":
        search(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 30)
    else:
        get(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 1920)
