#!/usr/bin/env python3
"""Run both tools on your own computer (Mac or Windows) without PHP.

Serves the tools folder and answers every tools/*/api.php request the same way tools/_core/router.php does.
Keys (DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, ANTHROPIC_API_KEY) come from a .env file: the one next to this
file, or ~/DataForSEO/.env if that is where you keep yours. With no keys yet, the first-run screen at
/tools/setup/ tests them and saves them to the .env next to this file.
Keys stay in this process and on this disk; the browser never gets them back. Data goes to tools/_data,
same format as the PHP version. The server only listens on this computer (127.0.0.1).

    python3 dev-server.py                 # then open http://localhost:8777/tools/
"""
import sys
if sys.version_info < (3, 7):
    sys.exit("This needs Python 3.7 or newer. Get it free at https://www.python.org/downloads/")
import argparse, base64, hashlib, json, os, re, secrets, ssl, stat, threading, time, urllib.error, urllib.parse, urllib.request, webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
CORE = os.path.join(ROOT, "tools", "_core")
DATA = os.path.join(ROOT, "tools", "_data")
GUARD = "<?php http_response_code(404); exit; ?>\n"
CFG = {
    "models": {"fast": "claude-haiku-5-5", "smart": "claude-sonnet-5-5"},
    "model_price": {"fast": [1, 5], "smart": [3, 15]},
    "cap_dfs": 10, "cap_claude": 3, "cache_days": 7,
    "dfs_base": os.environ.get("OT_DFS_BASE", "https://api.dataforseo.com/v3/"), "anthropic_base": os.environ.get("OT_ANTHROPIC_BASE", "https://api.anthropic.com/v1/"),
}
KEYS = {}
ENV_WRITE = os.path.join(ROOT, ".env")  # where the first-run screen saves keys
LOCAL_HOSTS = ("localhost", "127.0.0.1", "::1")
try:  # python.org installs on a Mac ship without root certificates; use certifi's when it is there
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl.create_default_context()
RECORD = None  # path of a .jsonl file: every dfs/ai/save call is written there, to build a demo tape
LOCK = threading.Lock()
_dfs_src = open(os.path.join(CORE, "dfs.php"), encoding="utf-8").read()
ALLOWED = set(re.findall(r"'([a-z_/]+)',", _dfs_src[_dfs_src.index("OT_DFS_ALLOWED"):_dfs_src.index("];")]))
SUMMARY = re.compile(r"^on_page/summary/[0-9a-f\-]{20,60}$")


def load_env(path):
    path = os.path.expanduser(path)
    vals = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip().strip('"').strip("'")
    KEYS["login"] = vals.get("DATAFORSEO_LOGIN") or os.environ.get("DATAFORSEO_LOGIN", "")
    KEYS["password"] = vals.get("DATAFORSEO_PASSWORD") or os.environ.get("DATAFORSEO_PASSWORD", "")
    KEYS["anthropic"] = vals.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY", "")
    return has_dfs()


def has_dfs():
    return bool(KEYS.get("login") and KEYS.get("password"))


def save_env(path, new):
    """Write the keys into the .env file, keeping any other lines already in it. Only this user can read it."""
    lines, seen = [], set()
    if os.path.exists(path):
        for line in open(path, encoding="utf-8").read().splitlines():
            k = line.split("=", 1)[0].strip() if "=" in line and not line.strip().startswith("#") else None
            if k in new:
                seen.add(k)
                if new[k]:
                    lines.append(f"{k}={new[k]}")
            else:
                lines.append(line)
    else:
        lines.append("# Your API keys for the SEO tools. They stay on this computer. Never share or upload this file.")
    lines += [f"{k}={v}" for k, v in new.items() if k not in seen and v]
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    try:
        os.chmod(tmp, stat.S_IRUSR | stat.S_IWUSR)
    except Exception:
        pass
    os.replace(tmp, path)


def net_error(code, j):
    msg = ((j or {}).get("error") or {}).get("message") if isinstance(j, dict) else ""
    msg = msg or (j or {}).get("status_message", "") if isinstance(j, dict) else msg
    if "CERTIFICATE_VERIFY_FAILED" in str(msg):
        return "Python on this Mac has no security certificates yet. Open Applications, then the Python folder, double-click Install Certificates.command, and try again."
    if code == 0:
        return "Could not reach the service. Check your internet connection and try again."
    return str(msg or f"HTTP {code}")[:200]


def check_dfs(login, password):
    auth = "Basic " + base64.b64encode(f"{login}:{password}".encode()).decode()
    code, j = http(CFG["dfs_base"] + "appendix/user_data", None, {"Authorization": auth}, timeout=30)
    t = ((j or {}).get("tasks") or [{}])[0] if isinstance(j, dict) else {}
    if isinstance(j, dict) and (t.get("status_code") or j.get("status_code")) == 20000:
        try:
            return True, {"balance": t["result"][0]["money"]["balance"]}
        except Exception:
            return True, {"balance": None}
    if code in (401, 403) or (isinstance(j, dict) and str(j.get("status_code", "")).startswith("401")):
        return False, "DataForSEO did not accept that login and password. Use the API login and API password from the API Access page, not the password you sign in with."
    return False, net_error(code, j)


def check_claude(key):
    code, j = http(CFG["anthropic_base"] + "models?limit=1", None, {"x-api-key": key, "anthropic-version": "2023-06-01"}, timeout=30)
    if code == 200:
        return True, {}
    if code in (401, 403):
        return False, "Claude did not accept that key. Copy the whole key again (it starts with sk-ant-)."
    return False, net_error(code, j)


def mask(v):
    v = str(v or "")
    return (v[:2] + "…" + v[-3:]) if len(v) > 8 else ("saved" if v else "")


def ddir(sub=""):
    for d in ("cache", "scans", "decks", "public", "logs", "settings"):
        os.makedirs(os.path.join(DATA, d), exist_ok=True)
    return os.path.join(DATA, sub) if sub else DATA


def write(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(GUARD + json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    os.replace(tmp, path)


def read(path):
    if not os.path.isfile(path):
        return None
    s = open(path, encoding="utf-8").read()
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
        with open(f, "a", encoding="utf-8") as h:
            if new:
                h.write(GUARD)
            h.write(json.dumps(row) + "\n")


def http(url, body=None, headers=None, timeout=90):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 method="POST" if body is not None else "GET", headers=headers or {})
    try:
        r = urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, None
    except Exception as e:
        return 0, {"error": {"message": str(e)}}


def dfs_raw(ep, task=None):
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
    if not has_dfs():
        return {"status_code": 401, "status_message": "Add your DataForSEO keys first: open /tools/setup/", "cost": 0, "result": None}
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
    P = json.load(open(os.path.join(CORE, "prompts.json"), encoding="utf-8"))
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
            with open(RECORD, "a", encoding="utf-8") as f:
                f.write(json.dumps({"a": a, "tool": tool, "name": name, "body": getattr(self, "_raw", ""), "res": res, "t": time.time()}) + "\n")

    def local_only(self):
        """Only pages served by this server may call the API: blocks other websites and DNS tricks."""
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
        origin = self.headers.get("Origin")
        return host in LOCAL_HOSTS and (not origin or urllib.parse.urlparse(origin).hostname in LOCAL_HOSTS)

    def keys_setup(self, post, b):
        if not post:
            return self.out({"dataforseo": has_dfs(), "claude": bool(KEYS.get("anthropic")), "login": mask(KEYS.get("login")), "file": ENV_WRITE})
        clean = lambda v: re.sub(r"[\r\n]", "", str(v or "")).strip()
        login, password, key = clean(b.get("login")), clean(b.get("password")), clean(b.get("anthropic"))
        login, password = login or KEYS.get("login", ""), password or KEYS.get("password", "")
        if not b.get("skip_claude"):
            key = key or KEYS.get("anthropic", "")
        errors, info = {}, {}
        if not (login and password):
            errors["dataforseo"] = "Enter your DataForSEO API login and API password."
        else:
            ok, r = check_dfs(login, password)
            if ok:
                info["balance"] = r.get("balance")
            else:
                errors["dataforseo"] = r
        if key:
            ok, r = check_claude(key)
            if not ok:
                errors["claude"] = r
        if errors:
            return self.out({"ok": False, "errors": errors})
        try:
            save_env(ENV_WRITE, {"DATAFORSEO_LOGIN": login, "DATAFORSEO_PASSWORD": password, "ANTHROPIC_API_KEY": key})
        except Exception as e:
            return self.out({"ok": False, "errors": {"save": "Could not write " + ENV_WRITE + ": " + str(e)}})
        KEYS.update(login=login, password=password, anthropic=key)
        return self.out({"ok": True, "balance": info.get("balance"), "claude": bool(key), "file": ENV_WRITE})

    def api(self, post):
        if not self.local_only():
            return self.out({"error": "This tool only answers pages opened from this computer."}, 403)
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        tool = u.path.strip("/").split("/")[-2] if u.path.count("/") >= 2 else ""
        a = q.get("a", "")
        b = self.body() if post else {}
        if a == "setup":
            return self.keys_setup(post, b)
        if a == "health":
            return self.out({"ok": True, "tool": tool, "mode": "local", "host": "dev-server", "setup": not has_dfs(), "keys": {"dataforseo": has_dfs(), "claude": bool(KEYS.get("anthropic"))},
                             "nonce": "", "models": CFG["models"], "spent": {"dfs": spend("dfs"), "claude": spend("claude"), "cap_dfs": CFG["cap_dfs"], "cap_claude": CFG["cap_claude"]}})
        if a == "deck":
            tok = q.get("id", "")
            d = read(ofile("public", tok)) if re.match(r"^[a-f0-9]{32}$", tok) else None
            return self.out(d) if d else self.out({"error": "not found"}, 404)
        if a == "balance":
            if not has_dfs():
                return self.out({"balance": None})
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
    ap.add_argument("--env", help="path of the .env file with your keys (default: .env next to this file, else ~/DataForSEO/.env)")
    ap.add_argument("--port", type=int, default=8777)
    ap.add_argument("--no-open", action="store_true")
    ap.add_argument("--record", help="write every API call to this .jsonl file (to build a demo)")
    a = ap.parse_args()
    global RECORD
    RECORD = a.record
    global ENV_WRITE
    here, home = os.path.join(ROOT, ".env"), os.path.expanduser("~/DataForSEO/.env")
    if a.env:
        ENV_WRITE = os.path.abspath(os.path.expanduser(a.env))
    ready = load_env(a.env or (here if os.path.exists(here) or not os.path.exists(home) else home))
    srv = None
    for port in range(a.port, a.port + 12):  # if the port is busy (the tool is already open, or another app has it), take the next one
        try:
            srv = ThreadingHTTPServer(("127.0.0.1", port), H)
            break
        except OSError:
            continue
    if not srv:
        sys.exit(f"Ports {a.port} to {a.port + 11} are all in use. Close the other copy of this tool and start again.")
    url = f"http://localhost:{port}/tools/" + ("" if ready else "setup/")
    print("")
    print("  SEO tools are running on this computer.")
    print(f"  Open  {url}")
    print(f"  Keys: DataForSEO {'yes' if ready else 'not yet (the first-run screen will ask)'} | Claude {'yes' if KEYS.get('anthropic') else 'no'}")
    print("  Leave this window open while you work. Close it (or press Ctrl+C) to stop.")
    print("")
    if not a.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
