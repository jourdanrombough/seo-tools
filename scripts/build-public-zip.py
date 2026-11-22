#!/usr/bin/env python3
"""Build the public download: claudinox-seo-pitch-deck-generator.zip

    python3 scripts/build-public-zip.py [--out DIR] [--start-url URL]

Takes the tools as they are in this repo and makes the copy other people run on their own computer:
  - the sample rate card (tools/browser/sample-rates.js) replaces your own rates.js
  - Mac and Windows start files and a README-FIRST.txt are added
  - no keys, no saved decks, no .git, nothing from tools/_data
The build stops if it finds a key or your contact details anywhere they should not be.
"""
import argparse, os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "scripts", "public")
TOP = "seo-pitch-deck-generator"
NAME = "claudinox-seo-pitch-deck-generator.zip"
SKIP_DIRS = {"_data", "__pycache__", ".git"}
SKIP_FILES = {".DS_Store", ".env", "local-config.php"}
# recorded demo runs and example scans show Optimization Theory on purpose; everything else must be neutral
BRANDED_OK = ("tools/demo/", "tools/traffic-gap/examples/")
PERSONAL = re.compile(r"jourdan@|973[.\-\s]?985", re.I)  # an author credit by name is fine; email and phone are not
SECRET = re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}|DATAFORSEO_PASSWORD\s*=\s*\S|ANTHROPIC_API_KEY\s*=\s*\S")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=ROOT)
    ap.add_argument("--start-url", default="https://optimizationtheory.com/pitch-deck-generator-setup/")
    a = ap.parse_args()

    files = {}  # path inside the zip -> (bytes, executable)

    def add(rel, data, exe=False):
        files[rel.replace(os.sep, "/")] = (data, exe)

    add("dev-server.py", open(os.path.join(ROOT, "dev-server.py"), "rb").read())
    for base, dirs, names in os.walk(os.path.join(ROOT, "tools")):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for n in sorted(names):
            if n in SKIP_FILES or n.endswith((".tmp", ".log", ".jsonl")):
                continue
            full = os.path.join(base, n)
            add(os.path.relpath(full, ROOT), open(full, "rb").read())

    sample = open(os.path.join(ROOT, "tools", "browser", "sample-rates.js"), encoding="utf-8").read()
    add("tools/pitch-deck/rates.js", sample.replace("window.OT_SAMPLE_RATES = {", "const DEFAULT_RATES = {").encode("utf-8"))
    s = files["tools/pitch-deck/settings/index.html"][0].decode("utf-8")
    s = s.replace("https://optimizationtheory.com/wp-content/uploads/logo.png", "https://youragency.com/logo.png")
    s = s.replace("the defaults from your rates page", "the sample rate card")
    add("tools/pitch-deck/settings/index.html", s.encode("utf-8"))

    add("Start on Mac.command", open(os.path.join(PUB, "Start on Mac.command"), "rb").read(), exe=True)
    add("Start on Windows.bat", open(os.path.join(PUB, "Start on Windows.bat"), "rb").read())
    add("README-FIRST.txt", open(os.path.join(PUB, "README-FIRST.txt"), encoding="utf-8").read().replace("__START_URL__", a.start_url).encode("utf-8"))

    problems = []
    for rel, (data, _) in files.items():
        if rel.endswith((".png", ".jpg", ".webp", ".ico")):
            continue
        text = data.decode("utf-8", "replace")
        if SECRET.search(text):
            problems.append(rel + ": looks like it contains a key")
        if PERSONAL.search(text) and not rel.startswith(BRANDED_OK):
            problems.append(rel + ": contains your contact details")
    if problems:
        sys.exit("Not built:\n  " + "\n  ".join(problems))

    out = os.path.join(a.out, NAME)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in sorted(files):
            data, exe = files[rel]
            zi = zipfile.ZipInfo(TOP + "/" + rel, date_time=(2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.create_system = 3  # unix, so the Mac start file keeps its "can run" flag
            zi.external_attr = ((0o755 if exe else 0o644) | 0o100000) << 16
            z.writestr(zi, data)
    print(f"{out}  ·  {len(files)} files  ·  {os.path.getsize(out) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
