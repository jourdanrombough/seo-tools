#!/usr/bin/env python3
"""Run both tools on your Mac without PHP.

Serves the tools folder and answers every tools/*/api.php request the same way tools/_core/router.php does,
using the keys in ~/DataForSEO/.env (DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, ANTHROPIC_API_KEY).
Keys stay in this process; the browser never sees them. Data goes to tools/_data, same format as the PHP version.

    python3 dev-server.py                 # then open http://localhost:8777/tools/
"""
import argparse, hashlib, json, os, re, secrets, threading, time, urllib.error, urllib.parse, urllib.request, webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
CORE = os.path.join(ROOT, "tools", "_core")
DATA = os.path.join(ROOT, "tools", "_data")
GUARD = "<?php http_response_code(404); exit; ?>\n"
CFG = {
    "models": {"fast": "claude-haiku-5-5", "smart": "claude-sonnet-5-5"},
    "model_price": {"fast": [1, 5], "smart": [3, 15]},
    "cap_dfs": 10, "cap_claude": 3, "cache_days": 7,
    "dfs_base": "https://api.dataforseo.com/v3/", "anthropic_base": "https://api.anthropic.com/v1/",
}
KEYS = {}
RECORD = None  # path of a .jsonl file: every dfs/ai/save call is written there, to build a demo tape
LOCK = threading.Lock()
_dfs_src = open(os.path.join(CORE, "dfs.php")).read()
ALLOWED = set(re.findall(r"'([a-z_/]+)',", _dfs_src[_dfs_src.index("OT_DFS_ALLOWED"):_dfs_src.index("];")]))
SUMMARY = re.compile(r"^on_page/summary/[0-9a-f\-]{20,60}$")


def load_env(path):
    path = os.path.expanduser(path)
    vals = {}
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip().strip('"').strip("'")
    KEYS["login"] = vals.get("DATAFORSEO_LOGIN") or os.environ.get("DATAFORSEO_LOGIN", "")
    KEYS["password"] = vals.get("DATAFORSEO_PASSWORD") or os.environ.get("DATAFORSEO_PASSWORD", "")
    KEYS["anthropic"] = vals.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY", "")
    if not (KEYS["login"] and KEYS["password"]):
        raise SystemExit("No DataForSEO keys found in " + path)


def ddir(sub=""):
    for d in ("cache", "scans", "decks", "public", "logs", "settings"):
        os.makedirs(os.path.join(DATA, d), exist_ok=True)
    return os.path.join(DATA, sub) if sub else DATA


def write(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        f.write(GUARD + json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    os.replace(tmp, path)


def read(path):
    if not os.path.isfile(path):
        return None
    s = open(path).read()
    if s.startswith("<?php"):
        s = s[s.index("\n") + 1:]
    try:
        return json.loads(s)
    except Exception:
        return None


def safe_id(i):
    return bool(re.match(r"^[a-z0-9][a-z0-9\-]{0,150}$", str(i or "")))


def ofile(kind, i):
    if kind not in ("scans", "decks", "public", "settings") or not safe_id(i):
        return None
    return os.path.join(ddir(kind), i + ".json.php")


def slug(s, n=70):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")[:n]


def spend(svc, add=0.0):
    f = os.path.join(ddir("logs"), "spend-" + time.strftime("%Y-%m-%d") + ".json.php")
    with LOCK:
        d = read(f) or {}
        if add > 0:
            d[svc] = round(d.get(svc, 0) + add, 5)
            write(f, d)
    return float(d.get(svc, 0))


def log(row):
    f = os.path.join(ddir("logs"), "calls-" + time.strftime("%Y-%m") + ".log.php")
    row["t"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with LOCK:
        new = not os.path.exists(f)
        with open(f, "a") as h:
            if new:
                h.write(GUARD)
            h.write(json.dumps(row) + "\n")


def http(url, body=None, headers=None, timeout=90):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 method="POST" if body is not None else "GET", headers=headers or {})
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, None
    except Exception as e:
        return 0, {"error": {"message": str(e)}}


def dfs_raw(ep, task=None):
    import base64
    auth = "Basic " + base64.b64encode(f'{KEYS["login"]}:{KEYS["password"]}'.encode()).decode()
    code, j = http(CFG["dfs_base"] + ep, [task] if task is not None else None, {"Authorization": auth, "Content-Type": "application/json"})
    if not isinstance(j, dict):
        return {"status_code": 0, "status_message": f"HTTP {code}", "cost": 0, "result": None}
    t = (j.get("tasks") or [{}])[0]
    return {"status_code": t.get("status_code", j.get("status_code")), "status_message": t.get("status_message", j.get("status_message")),
            "cost": float(t.get("cost") or 0), "result": t.get("result"), "id": t.get("id")}


def dfs(ep, task, fresh=False, tool=""):
    is_sum = bool(SUMMARY.match(ep))
    if ep not in ALLOWED and not is_sum:
        return {"status_code": 403, "status_message": "Endpoint not allowed: " + ep, "cost": 0, "result": None}
    path = os.path.join(ddir("cache"), "dfs-" + hashlib.sha1((ep + json.dumps(task, separators=(",", ":"))).encode()).hexdigest() + ".json.php")
    if not fresh and os.path.exists(path) and time.time() - os.path.getmtime(path) < CFG["cache_days"] * 86400:
        r = read(path)
        if r:
            r["cached"] = True; r["cost"] = 0
            return r
    if spend("dfs") >= CFG["cap_dfs"]:
        return {"status_code": 429, "status_message": "Daily DataForSEO limit reached", "cost": 0, "result": None}
    t0 = time.time()
    r = dfs_raw(ep, None if is_sum else task)
    r["seconds"] = round(time.time() - t0, 2)
    if r["cost"]:
        spend("dfs", r["cost"])
    log({"svc": "dfs", "tool": tool, "ep": ep, "cost": r["cost"], "s": r["seconds"], "ok": r["status_code"] == 20000})
    done = not is_sum or ((r.get("result") or [{}])[0] or {}).get("crawl_progress") == "finished"
    if r["status_code"] in (20000, 20100) and done:
        write(path, r)
    return r


def json_from_text(txt):
    txt = re.sub(r"```(?:json)?", "", txt or "", flags=re.I)
    a, end = txt.find("{"), len(txt)
    if a < 0:
        return None
    for _ in range(6):
        b = txt.rfind("}", 0, end)
        if b < a:
            break
        s = txt[a:b + 1]
        for cand in (s, re.sub(r",\s*([}\]])", r"\1", s)):
            try:
                j = json.loads(cand)
                if isinstance(j, dict):
                    return j
            except Exception:
                pass
        end = b
    return None


def ai_task(name, data, note="", tool=""):
    P = json.load(open(os.path.join(CORE, "prompts.json")))
    if not name or name.startswith("_") or name not in P:
        return {"ok": False, "error": "Unknown AI task"}
    t = P[name]; tier = t.get("model", "fast"); model = CFG["models"][tier]
    note = (note or "").strip()[:600]
    user = (f"Note from the SEO running this: {note}\n\n" if note else "") + "Data:\n" + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    if not KEYS.get("anthropic"):
        return {"ok": False, "fallback": True, "error": "No Claude key"}
    cpath = os.path.join(ddir("cache"), "ai-" + hashlib.sha1((model + t["system"] + user).encode()).hexdigest() + ".json.php")
    if os.path.exists(cpath) and time.time() - os.path.getmtime(cpath) < CFG["cache_days"] * 86400:
        c = read(cpath)
        if c:
            c["cached"] = True; c["cost"] = 0
            return c
    if spend("claude") >= CFG["cap_claude"]:
        return {"ok": False, "fallback": True, "error": "Daily Claude limit reached"}
    t0, err = time.time(), ""
    for _ in range(2):
        code, j = http(CFG["anthropic_base"] + "messages",
                       dict({"model": model, "max_tokens": t.get("max_tokens", 1500), "system": t["system"], "messages": [{"role": "user", "content": user}]}, **({"output_config": {"effort": t["effort"]}} if t.get("effort") else {})),
                       {"content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": KEYS["anthropic"]}, timeout=80)
        if code == 200 and j:
            txt = "".join(b.get("text", "") for b in j.get("content", []) if b.get("type") == "text")
            u = j.get("usage", {}); pi, po = CFG["model_price"][tier]
            cost = round((u.get("input_tokens", 0) * pi + u.get("output_tokens", 0) * po) / 1e6, 5)
            spend("claude", cost)
            parsed = json_from_text(txt); secs = round(time.time() - t0, 2)
            log({"svc": "claude", "tool": tool, "task": name, "model": model, "in": u.get("input_tokens"), "out": u.get("output_tokens"), "cost": cost, "s": secs, "ok": bool(parsed)})
            if parsed:
                res = {"ok": True, "json": parsed, "model": model, "cost": cost, "seconds": secs}
                write(cpath, res)
                return res
            err = "Claude did not return JSON"
            continue
        err = ((j or {}).get("error") or {}).get("message") or f"HTTP {code}"
        if code not in (0, 429, 500, 502, 503, 529):
            break
        time.sleep(1.2)
    log({"svc": "claude", "tool": tool, "task": name, "model": model, "cost": 0, "ok": False, "err": err[:200]})
    return {"ok": False, "fallback": True, "error": err}


def list_kind(kind):
    d = ddir(kind)
    files = sorted([f for f in os.listdir(d) if f.endswith(".json.php")], key=lambda f: -os.path.getmtime(os.path.join(d, f)))[:60]
    out = []
    for f in files:
        x = read(os.path.join(d, f))
        if not x:
            continue
        i = f[:-9]
        if kind == "scans":
            out.append({"id": i, "domain": x.get("domain", ""), "keyword": x.get("keyword", ""), "note": x.get("note", ""), "location": (x.get("location") or {}).get("label", ""),
                        "region": (x.get("location") or {}).get("abbr") or "", "date": x.get("date", ""), "headline": x.get("headline", "")})
        else:
            inp = x.get("input") or {}
            out.append({"id": i, "domain": inp.get("domain", ""), "business": inp.get("business", ""), "date": x.get("updated") or x.get("created", ""),
                        "status": x.get("status", "draft"), "token": x.get("token"), "headline": x.get("headline", "")})
    return out


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):
        if "api.php" in (args[0] if args else ""):
            super().log_message(fmt, *args)

    def out(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        self._raw = (self.rfile.read(n) or b"{}").decode("utf-8", "replace")
        try:
            return json.loads(self._raw)
        except Exception:
            return {}

    def rec(self, a, tool, name, res):
        if not RECORD:
            return
        with LOCK:
            with open(RECORD, "a") as f:
                f.write(json.dumps({"a": a, "tool": tool, "name": name, "body": getattr(self, "_raw", ""), "res": res, "t": time.time()}) + "\n")

    def api(self, post):
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        tool = u.path.strip("/").split("/")[-2] if u.path.count("/") >= 2 else ""
        a = q.get("a", "")
        b = self.body() if post else {}
        if a == "health":
            return self.out({"ok": True, "tool": tool, "mode": "local", "host": "dev-server", "keys": {"dataforseo": True, "claude": bool(KEYS.get("anthropic"))},
                             "nonce": "", "models": CFG["models"], "spent": {"dfs": spend("dfs"), "claude": spend("claude"), "cap_dfs": CFG["cap_dfs"], "cap_claude": CFG["cap_claude"]}})
        if a == "deck":
            tok = q.get("id", "")
            d = read(ofile("public", tok)) if re.match(r"^[a-f0-9]{32}$", tok) else None
            return self.out(d) if d else self.out({"error": "not found"}, 404)
        if a == "balance":
            r = dfs_raw("appendix/user_data")
            try:
                return self.out({"balance": r["result"][0]["money"]["balance"]})
            except Exception:
                return self.out({"balance": None})
        if a == "dfs":
            r = dfs(b.get("endpoint", ""), b.get("task") or {}, bool(b.get("fresh")), tool)
            self.rec(a, tool, b.get("endpoint", ""), r)
            return self.out(r)
        if a == "ai":
            r = ai_task(b.get("task", ""), b.get("data") or {}, b.get("note", ""), tool)
            self.rec(a, tool, b.get("task", ""), r)
            return self.out(r)
        if a == "save":
            kind, d, i = b.get("kind", "scans"), b.get("data"), b.get("id") or ""
            if kind not in ("scans", "decks") or not isinstance(d, dict):
                return self.out({"error": "Bad save"}, 400)
            if not safe_id(i):
                if kind == "scans":
                    loc = d.get("location") or {}
                    i = time.strftime("%Y%m%d-%H%M") + "-" + slug(f'{d.get("domain","scan")}-{d.get("keyword") or "site"}-{loc.get("abbr") or loc.get("label","")}') + "-" + secrets.token_hex(3)
                else:
                    i = time.strftime("%Y%m%d") + "-" + slug((d.get("input") or {}).get("domain", "deck"), 40) + "-" + secrets.token_hex(4)
            if kind == "decks":
                old = read(ofile("decks", i))
                if old and old.get("token") and not d.get("token"):
                    d["token"] = old["token"]
                d["updated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
            write(ofile(kind, i), d)
            self.rec(a, tool, kind, {"id": i})
            return self.out({"id": i, "token": d.get("token")})
        if a == "list":
            return self.out(list_kind(q.get("kind", "scans")))
        if a == "get":
            f = ofile(q.get("kind", "scans"), q.get("id", ""))
            d = read(f) if f else None
            return self.out(d) if d else self.out({"error": "not found"}, 404)
        if a == "rates":
            f = ofile("settings", "rates")
            if post:
                write(f, b.get("rates") or {})
                return self.out({"ok": True})
            return self.out({"rates": read(f)})
        if a in ("publish", "unpublish"):
            f = ofile("decks", b.get("id", ""))
            d = read(f) if f else None
            if not d:
                return self.out({"error": "not found"}, 404)
            if a == "unpublish":
                if d.get("token"):
                    p = ofile("public", d["token"])
                    if p and os.path.exists(p):
                        os.remove(p)
                d["status"] = "draft"; write(f, d)
                return self.out({"ok": True})
            if not d.get("view"):
                return self.out({"error": "Deck not built yet"}, 404)
            tok = d.get("token") if re.match(r"^[a-f0-9]{32}$", d.get("token") or "") else secrets.token_hex(16)
            pub = dict(d["view"]); pub["published"] = time.strftime("%Y-%m-%dT%H:%M:%S"); pub["expires"] = b.get("expires") or None
            write(ofile("public", tok), pub)
            d.update(token=tok, status="published", published=pub["published"], expires=pub["expires"]); write(f, d)
            return self.out({"token": tok})
        return self.out({"error": "Unknown action"}, 404)

    def do_GET(self):
        p = urllib.parse.urlparse(self.path).path
        if p.endswith("/api.php"):
            return self.api(False)
        if "/_data" in p or "/_core" in p or "/." in p or p.endswith(".py"):
            return self.out({"error": "not found"}, 404)
        if p.endswith("/p/") or p.endswith("/p/index.php"):
            self.path = p.rsplit("/p/", 1)[0] + "/p/viewer.html" + ("?" + urllib.parse.urlparse(self.path).query if "?" in self.path else "")
        return super().do_GET()

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path.endswith("/api.php"):
            return self.api(True)
        self.out({"error": "not found"}, 404)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", default="~/DataForSEO/.env")
    ap.add_argument("--port", type=int, default=8777)
    ap.add_argument("--no-open", action="store_true")
    ap.add_argument("--record", help="write every API call to this .jsonl file (to build a demo)")
    a = ap.parse_args()
    global RECORD
    RECORD = a.record
    load_env(a.env)
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), H)
    url = f"http://localhost:{a.port}/tools/"
    print(f"SEO tools running at {url}  (Claude key: {'yes' if KEYS.get('anthropic') else 'no'})  Ctrl+C to stop")
    if not a.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
