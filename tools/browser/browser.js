/* Browser mode: the tools with no server at all.
   On a static host (GitHub Pages) or with ?browser=1, every api.php request the pages make is answered right here
   in the browser instead. Your DataForSEO login and Claude key are kept in this browser's own storage and sent
   only to api.dataforseo.com and api.anthropic.com. Scans, decks, the rate card and the 7-day cache live in this
   browser too (IndexedDB), so nothing reaches the site that served this page.
   Same actions and answers as tools/_core/router.php and dev-server.py. */
window.BROWSER = (() => {
  if (window.DEMO) return null;
  const q = new URLSearchParams(location.search);
  let on = /\.github\.io$/.test(location.hostname) || location.protocol === "file:";
  try { if (q.get("browser") === "1") sessionStorage.setItem("ot_browser", "1"); on = on || sessionStorage.getItem("ot_browser") === "1"; } catch (e) { on = on || q.get("browser") === "1"; }
  if (!on) return null;

  const here = document.currentScript ? new URL(".", document.currentScript.src).href : "../browser/";
  const CFG = {
    models: { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5" }, price: { fast: [1, 5], smart: [3, 15] },
    capDfs: 10, capClaude: 3, cacheDays: 7,
    dfs: window.OT_DFS_BASE || "https://api.dataforseo.com/v3/", anthropic: window.OT_ANTHROPIC_BASE || "https://api.anthropic.com/v1/",
  };
  const ALLOWED = new Set(["dataforseo_labs/google/domain_rank_overview/live", "dataforseo_labs/google/ranked_keywords/live", "dataforseo_labs/google/keywords_for_site/live",
    "dataforseo_labs/google/related_keywords/live", "dataforseo_labs/google/keyword_suggestions/live", "dataforseo_labs/google/serp_competitors/live",
    "keywords_data/google_ads/search_volume/live", "serp/google/organic/live/advanced", "backlinks/summary/live",
    "ai_optimization/claude/llm_responses/live", "ai_optimization/chat_gpt/llm_responses/live", "on_page/task_post"]);
  const SUMMARY = /^on_page\/summary\/[0-9a-f\-]{20,60}$/;
  const KEYS_AT = "ot_keys";

  /* ---------- keys: this browser only ---------- */
  function keys() {
    for (const s of [sessionStorage, localStorage]) { try { const k = JSON.parse(s.getItem(KEYS_AT) || "null"); if (k && k.login) return k; } catch (e) { } }
    return { login: "", password: "", anthropic: "" };
  }
  function saveKeys(k, remember) {
    forgetKeys();
    (remember === false ? sessionStorage : localStorage).setItem(KEYS_AT, JSON.stringify(k));
  }
  function forgetKeys() { try { localStorage.removeItem(KEYS_AT); sessionStorage.removeItem(KEYS_AT); } catch (e) { } }
  const hasDfs = () => { const k = keys(); return !!(k.login && k.password); };
  const mask = v => { v = String(v || ""); return v.length > 8 ? v.slice(0, 2) + "…" + v.slice(-3) : (v ? "saved" : ""); };
  const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

  /* ---------- storage: one small key/value table ---------- */
  let dbp = null;
  function db() {
    return dbp || (dbp = new Promise((ok, bad) => {
      const r = indexedDB.open("ot-seo-tools", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv", { keyPath: "k" });
      r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
    }));
  }
  const tx = async (mode, fn) => { const d = await db(); return new Promise((ok, bad) => { const t = d.transaction("kv", mode), rq = fn(t.objectStore("kv")); t.oncomplete = () => ok(rq && rq.result); t.onerror = t.onabort = () => bad(t.error); }); };
  const put = (k, v) => tx("readwrite", s => s.put({ k, v, t: Date.now() }));
  const row = k => tx("readonly", s => s.get(k));
  const get = async k => { const r = await row(k); return r ? r.v : null; };
  const del = k => tx("readwrite", s => s.delete(k));
  const all = prefix => tx("readonly", s => s.getAll(IDBKeyRange.bound(prefix, prefix + "￿")));

  /* ---------- helpers ---------- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pad = n => String(n).padStart(2, "0");
  const stamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const day = () => stamp().slice(0, 10);
  const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, "0")).join("");
  const slug = (s, n = 70) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, n);
  const safeId = i => /^[a-z0-9][a-z0-9\-]{0,150}$/.test(String(i || ""));
  function hash(str) { // cyrb53: a cache key, not security
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0") + "-" + str.length;
  }
  async function spend(svc, add) {
    const k = "spend:" + day(), d = (await get(k)) || {};
    if (add > 0) { d[svc] = Math.round(((d[svc] || 0) + add) * 1e5) / 1e5; await put(k, d); }
    return +(d[svc] || 0);
  }
  const fresh = r => r && Date.now() - r.t < CFG.cacheDays * 864e5;
  async function http(url, body, headers, timeout = 90000) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), timeout);
    try {
      const r = await REAL(url, { method: body !== undefined ? "POST" : "GET", headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: c.signal, cache: "no-store" });
      let j = null; try { j = await r.json(); } catch (e) { }
      return [r.status, j];
    } catch (e) { return [0, { error: { message: e.name === "AbortError" ? "Timed out" : "Could not reach the service. Check your connection (an ad blocker can also block this)." } }]; }
    finally { clearTimeout(t); }
  }

  /* ---------- DataForSEO ---------- */
  async function dfsRaw(ep, task, k = keys()) {
    const [code, j] = await http(CFG.dfs + ep, task == null ? undefined : [task], { Authorization: "Basic " + b64(k.login + ":" + k.password), "Content-Type": "application/json" });
    if (!j || typeof j !== "object" || j.error) return { status_code: 0, status_message: (j && j.error && j.error.message) || "HTTP " + code, cost: 0, result: null };
    const t = (j.tasks || [{}])[0] || {};
    return { status_code: t.status_code != null ? t.status_code : j.status_code, status_message: t.status_message != null ? t.status_message : j.status_message, cost: +(t.cost || 0), result: t.result != null ? t.result : null, id: t.id };
  }
  async function dfs(ep, task, isFresh) {
    const isSum = SUMMARY.test(ep);
    if (!ALLOWED.has(ep) && !isSum) return { status_code: 403, status_message: "Endpoint not allowed: " + ep, cost: 0, result: null };
    if (!hasDfs()) return { status_code: 401, status_message: "Add your DataForSEO keys first: open the keys page", cost: 0, result: null };
    const ck = "cache:dfs:" + hash(ep + JSON.stringify(task || {}));
    if (!isFresh) { const c = await row(ck); if (fresh(c)) return Object.assign({}, c.v, { cached: true, cost: 0 }); }
    if (await spend("dfs") >= CFG.capDfs) return { status_code: 429, status_message: "Daily DataForSEO limit reached", cost: 0, result: null };
    const t0 = performance.now(), r = await dfsRaw(ep, isSum ? null : task);
    r.seconds = Math.round((performance.now() - t0) / 10) / 100;
    if (r.cost) await spend("dfs", r.cost);
    const done = !isSum || ((r.result || [{}])[0] || {}).crawl_progress === "finished";
    if ((r.status_code === 20000 || r.status_code === 20100) && done) { try { await put(ck, r); } catch (e) { } }
    return r;
  }

  /* ---------- Claude ---------- */
  let prompts = null;
  const loadPrompts = async () => prompts || (prompts = await (await REAL(new URL("../_core/prompts.json", here).href, { cache: "force-cache" })).json());
  function jsonFromText(txt) {
    txt = String(txt || "").replace(/```(?:json)?/gi, "");
    const a = txt.indexOf("{"); let end = txt.length;
    if (a < 0) return null;
    for (let n = 0; n < 6; n++) {
      const b = txt.lastIndexOf("}", end - 1);
      if (b < a) break;
      const s = txt.slice(a, b + 1);
      for (const cand of [s, s.replace(/,\s*([}\]])/g, "$1")]) { try { const j = JSON.parse(cand); if (j && typeof j === "object" && !Array.isArray(j)) return j; } catch (e) { } }
      end = b;
    }
    return null;
  }
  async function ai(name, data, note) {
    let P; try { P = await loadPrompts(); } catch (e) { return { ok: false, fallback: true, error: "Could not load the prompts" }; }
    if (!name || name[0] === "_" || !P[name]) return { ok: false, error: "Unknown AI task" };
    const t = P[name], tier = t.model || "fast", model = CFG.models[tier], key = keys().anthropic;
    note = String(note || "").trim().slice(0, 600);
    const user = (note ? "Note from the SEO running this: " + note + "\n\n" : "") + "Data:\n" + JSON.stringify(data || {});
    if (!key) return { ok: false, fallback: true, error: "No Claude key" };
    const ck = "cache:ai:" + hash(model + t.system + user), c = await row(ck);
    if (fresh(c)) return Object.assign({}, c.v, { cached: true, cost: 0 });
    if (await spend("claude") >= CFG.capClaude) return { ok: false, fallback: true, error: "Daily Claude limit reached" };
    const t0 = performance.now(); let err = "";
    for (let n = 0; n < 2; n++) {
      const body = { model, max_tokens: t.max_tokens || 1500, system: t.system, messages: [{ role: "user", content: user }] };
      if (t.effort) body.output_config = { effort: t.effort };
      const [code, j] = await http(CFG.anthropic + "messages", body, { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": key, "anthropic-dangerous-direct-browser-access": "true" }, 120000);
      if (code === 200 && j) {
        const txt = (j.content || []).filter(b => b.type === "text").map(b => b.text || "").join(""), u = j.usage || {}, [pi, po] = CFG.price[tier];
        const cost = Math.round(((u.input_tokens || 0) * pi + (u.output_tokens || 0) * po) / 1e6 * 1e5) / 1e5;
        await spend("claude", cost);
        const parsed = jsonFromText(txt), seconds = Math.round((performance.now() - t0) / 10) / 100;
        if (parsed) { const res = { ok: true, json: parsed, model, cost, seconds }; try { await put(ck, res); } catch (e) { } return res; }
        err = "Claude did not return JSON"; continue;
      }
      err = (j && j.error && j.error.message) || "HTTP " + code;
      if (![0, 429, 500, 502, 503, 529].includes(code)) break;
      await sleep(1200);
    }
    return { ok: false, fallback: true, error: err };
  }

  /* ---------- first run: test the keys, then keep them in this browser ---------- */
  async function checkDfs(login, password) {
    const [code, j] = await http(CFG.dfs + "appendix/user_data", undefined, { Authorization: "Basic " + b64(login + ":" + password) }, 30000);
    const t = j && (j.tasks || [{}])[0] || {};
    if (j && (t.status_code || j.status_code) === 20000) { let bal = null; try { bal = t.result[0].money.balance; } catch (e) { } return [true, { balance: bal }]; }
    if (code === 401 || code === 403 || (j && /^401/.test(String(j.status_code || "")))) return [false, "DataForSEO did not accept that login and password. Use the API login and API password from the API Access page, not the password you sign in with."];
    return [false, (j && j.error && j.error.message) || (j && j.status_message) || "HTTP " + code];
  }
  async function checkClaude(key) {
    const [code, j] = await http(CFG.anthropic + "models?limit=1", undefined, { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, 30000);
    if (code === 200) return [true, {}];
    if (code === 401 || code === 403) return [false, "Claude did not accept that key. Copy the whole key again (it starts with sk-ant-)."];
    return [false, (j && j.error && j.error.message) || "HTTP " + code];
  }
  async function setup(post, b) {
    const k = keys(), where = "this browser";
    if (!post) return { dataforseo: hasDfs(), claude: !!k.anthropic, login: mask(k.login), file: where, browser: true };
    if (b.forget) { forgetKeys(); return { ok: true, forgotten: true }; }
    const clean = v => String(v || "").replace(/[\r\n]/g, "").trim();
    const login = clean(b.login) || k.login, password = clean(b.password) || k.password, key = clean(b.anthropic) || (b.skip_claude ? "" : k.anthropic);
    const errors = {}, info = {};
    if (!(login && password)) errors.dataforseo = "Enter your DataForSEO API login and API password.";
    else { const [ok, r] = await checkDfs(login, password); if (ok) info.balance = r.balance; else errors.dataforseo = r; }
    if (key) { const [ok, r] = await checkClaude(key); if (!ok) errors.claude = r; }
    if (Object.keys(errors).length) return { ok: false, errors };
    try { saveKeys({ login, password, anthropic: key }, b.remember); } catch (e) { return { ok: false, errors: { save: "This browser would not save the keys (private window or storage turned off)." } }; }
    return { ok: true, balance: info.balance != null ? info.balance : null, claude: !!key, file: where, browser: true };
  }

  /* ---------- scans, decks, rate card ---------- */
  async function list(kind) {
    const rows = (await all(kind + ":")).sort((a, b) => b.t - a.t).slice(0, 60);
    return rows.map(r => {
      const x = r.v || {}, id = r.k.slice(kind.length + 1);
      if (kind === "scans") { const loc = x.location || {}; return { id, domain: x.domain || "", keyword: x.keyword || "", note: x.note || "", location: loc.label || "", region: loc.abbr || "", date: x.date || "", headline: x.headline || "" }; }
      const inp = x.input || {};
      return { id, domain: inp.domain || "", business: inp.business || "", date: x.updated || x.created || "", status: x.status || "draft", token: x.token || null, headline: x.headline || "" };
    });
  }
  async function save(b) {
    const kind = b.kind || "scans", d = b.data; let id = b.id || "";
    if (!["scans", "decks"].includes(kind) || !d || typeof d !== "object" || Array.isArray(d)) return [{ error: "Bad save" }, 400];
    if (!safeId(id)) {
      const n = new Date();
      if (kind === "scans") { const loc = d.location || {}; id = `${n.getFullYear()}${pad(n.getMonth() + 1)}${pad(n.getDate())}-${pad(n.getHours())}${pad(n.getMinutes())}-` + slug(`${d.domain || "scan"}-${d.keyword || "site"}-${loc.abbr || loc.label || ""}`) + "-" + hex(3); }
      else id = `${n.getFullYear()}${pad(n.getMonth() + 1)}${pad(n.getDate())}-` + slug((d.input || {}).domain || "deck", 40) + "-" + hex(4);
    }
    if (kind === "decks") { const old = await get("decks:" + id); if (old && old.token && !d.token) d.token = old.token; d.updated = stamp(); }
    await put(kind + ":" + id, d);
    return [{ id, token: d.token || null }];
  }
  async function publish(a, b) {
    const d = safeId(b.id) ? await get("decks:" + b.id) : null;
    if (!d) return [{ error: "not found" }, 404];
    if (a === "unpublish") { if (d.token) await del("public:" + d.token); d.status = "draft"; await put("decks:" + b.id, d); return [{ ok: true }]; }
    if (!d.view) return [{ error: "Deck not built yet" }, 404];
    const tok = /^[a-f0-9]{32}$/.test(d.token || "") ? d.token : hex(16), pub = Object.assign({}, d.view, { published: stamp(), expires: b.expires || null });
    await put("public:" + tok, pub);
    Object.assign(d, { token: tok, status: "published", published: pub.published, expires: pub.expires }); await put("decks:" + b.id, d);
    return [{ token: tok, local: true }];
  }

  /* ---------- the api.php actions ---------- */
  async function api(a, body, qs, post) {
    const p = new URLSearchParams(qs || ""), b = body || {};
    switch (a) {
      case "setup": return [await setup(post, b)];
      case "health": { const k = keys(); return [{ ok: true, mode: "local", host: "browser", browser: true, setup: !hasDfs(), keys: { dataforseo: hasDfs(), claude: !!k.anthropic }, nonce: "", models: CFG.models, spent: { dfs: await spend("dfs"), claude: await spend("claude"), cap_dfs: CFG.capDfs, cap_claude: CFG.capClaude } }]; }
      case "deck": { const tok = p.get("id") || "", d = /^[a-f0-9]{32}$/.test(tok) ? await get("public:" + tok) : null; return d ? [d] : [{ error: "This deck was published from another browser, so it only opens there. Ask for the PowerPoint or PDF." }, 404]; }
      case "balance": { if (!hasDfs()) return [{ balance: null }]; const r = await dfsRaw("appendix/user_data"); try { return [{ balance: r.result[0].money.balance }]; } catch (e) { return [{ balance: null }]; } }
      case "dfs": return [await dfs(b.endpoint || "", b.task || {}, !!b.fresh)];
      case "ai": return [await ai(b.task || "", b.data || {}, b.note || "")];
      case "save": return save(b);
      case "list": return [await list(p.get("kind") === "decks" ? "decks" : "scans")];
      case "get": { const kind = p.get("kind") === "decks" ? "decks" : "scans", d = safeId(p.get("id")) ? await get(kind + ":" + p.get("id")) : null; return d ? [d] : [{ error: "not found" }, 404]; }
      case "rates": { if (post) { await put("settings:rates", b.rates || {}); return [{ ok: true }]; } const r = await get("settings:rates"); return [{ rates: r || window.OT_SAMPLE_RATES || null }]; }
      case "publish": case "unpublish": return publish(a, b);
    }
    return [{ error: "Unknown action" }, 404];
  }

  /* every api.php request from the pages is answered here; everything else goes out as normal */
  const REAL = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "", m = /(?:^|\/)api\.php\?([^#]*)/.exec(url);
    if (!m) return REAL(input, init);
    const p = new URLSearchParams(m[1]), a = p.get("a") || ""; p.delete("a");
    let body; try { body = init && init.body ? JSON.parse(init.body) : undefined; } catch (e) { body = {}; }
    const post = !!(init && String(init.method || "").toUpperCase() === "POST");
    return api(a, body, p.toString(), post)
      .catch(e => [{ error: "This browser could not store or read the data: " + (e && e.message || e) }, 500])
      .then(([j, status]) => new Response(JSON.stringify(j), { status: status || 200, headers: { "Content-Type": "application/json; charset=utf-8" } }));
  };

  /* the sample rate card stands in for the site owner's own until you save yours */
  try { if (window.OT_SAMPLE_RATES && typeof DEFAULT_RATES === "object") { Object.keys(DEFAULT_RATES).forEach(k => delete DEFAULT_RATES[k]); Object.assign(DEFAULT_RATES, JSON.parse(JSON.stringify(window.OT_SAMPLE_RATES))); } } catch (e) { }

  /* backup and restore: everything except the keys */
  async function backup() {
    const out = { app: "ot-seo-tools", version: 1, saved: stamp(), items: [] };
    for (const pre of ["scans:", "decks:", "public:", "settings:"]) (await all(pre)).forEach(r => out.items.push(r));
    return out;
  }
  async function restore(data) {
    if (!data || data.app !== "ot-seo-tools" || !Array.isArray(data.items)) throw new Error("That file is not a backup from this tool.");
    let n = 0;
    for (const r of data.items) if (r && typeof r.k === "string" && /^(scans|decks|public|settings):/.test(r.k)) { await tx("readwrite", s => s.put({ k: r.k, v: r.v, t: r.t || Date.now() })); n++; }
    return n;
  }
  return { api: (a, body, qs) => api(a, body, qs, body !== undefined).then(r => r[0]), backup, restore, forgetKeys, keys: () => { const k = keys(); return { dataforseo: hasDfs(), claude: !!k.anthropic }; } };
})();
if (window.BROWSER) document.documentElement.classList.add("is-browser");
