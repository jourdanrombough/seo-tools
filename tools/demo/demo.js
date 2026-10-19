/* Demo mode: open any tool with ?demo=1 and it replays a recorded live run (tools/demo/tape.json).
   Every screen, step and animation is the real app; the API answers come from the recording, so nothing
   is called and nothing costs money. Saved decks and published links stay in this browser. */
window.DEMO = (() => {
  const q = new URLSearchParams(location.search);
  // on GitHub Pages there is no backend, so every page runs as the demo
  if (q.get("demo") !== "1" && !/\.github\.io$/.test(location.hostname)) return null;
  const here = document.currentScript ? new URL(".", document.currentScript.src).href : "../demo/";
  let tape = null, byKey = null, byName = null;
  const mem = { decks: {}, scans: {} };
  const clone = x => JSON.parse(JSON.stringify(x));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const recall = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const norm = name => String(name || "").replace(/^on_page\/summary\/.*/, "on_page/summary");

  async function load() {
    if (tape) return tape;
    tape = await (await fetch(here + "tape.json", { cache: "force-cache" })).json();
    byKey = {}; byName = {};
    tape.calls.forEach(c => {
      (byKey[c.a + "|" + c.body] = byKey[c.a + "|" + c.body] || []).push(c);
      (byName[c.a + "|" + norm(c.name)] = byName[c.a + "|" + norm(c.name)] || []).push(c);
    });
    return tape;
  }
  // exact request first (in order), then the next recorded call of the same kind
  function find(a, name, raw) {
    const k = byKey[a + "|" + raw];
    if (k && k.length) { const last = k.length === 1, c = last ? k[0] : k.shift(); c.used = true; c.last = last; return c; }
    const n = byName[a + "|" + norm(name)];
    if (n && n.length) { const c = n.find(x => !x.used) || n[n.length - 1]; c.used = true; return c; }
    return null;
  }

  async function api(n, body, qs) {
    await load();
    const p = new URLSearchParams(qs || "");
    switch (n) {
      case "health": return { ok: true, mode: "local", demo: true, host: "demo", keys: { dataforseo: true, claude: true }, nonce: "" };
      case "balance": return { balance: null };
      case "rates": return body ? { ok: false, error: "Demo mode: changes aren't saved" } : { rates: tape.rates || null };
      case "dfs": case "ai": {
        const name = n === "dfs" ? body.endpoint : body.task;
        // crawl progress: skip the minutes of polling and show the finished crawl after a short wait
        if (n === "dfs" && /^on_page\/summary\//.test(name)) {
          const all = byName["dfs|on_page/summary"] || [], c = all[all.length - 1];
          await sleep(4000);
          if (!c) return { status_code: 0, status_message: "Not in the demo recording", cost: 0, result: null };
          const out = clone(c.res); out._last = true; return out;
        }
        const c = find(n, name, JSON.stringify(body));
        if (!c) return n === "dfs" ? { status_code: 0, status_message: "Not in the demo recording", cost: 0, result: null } : { ok: false, error: "Not in the demo recording" };
        await sleep(Math.min(n === "ai" ? 3.2 : 1.5, Math.max(.25, +(c.res.seconds || 1) * .5)) * 1000);
        const out = clone(c.res); if (c.last) out._last = true; return out;
      }
      case "save": {
        const kind = body.kind === "decks" ? "decks" : "scans", id = body.id || `demo-${kind}-${Object.keys(mem[kind]).length + 1}`;
        mem[kind][id] = clone(body.data);
        if (kind === "decks" && body.data.view) store("ot_demo_view", body.data.view);
        return { id, token: body.data.token || null };
      }
      case "list": {
        if (p.get("kind") === "decks") return [{ id: "sample", domain: tape.deck.input.domain, business: tape.deck.input.business + " (sample)", date: tape.deck.updated || tape.recorded, status: "sample", headline: tape.deck.headline }]
          .concat(Object.entries(mem.decks).map(([id, d]) => ({ id, domain: d.input.domain, business: d.input.business, date: d.updated || d.created, status: d.status || "draft", headline: d.headline })));
        return [];
      }
      case "get": {
        const id = p.get("id"), kind = p.get("kind");
        if (kind === "decks") return clone(mem.decks[id] || tape.deck);
        return clone(mem.scans[id] || tape.scan);
      }
      case "publish": { const d = mem.decks[body.id] || tape.deck; if (d.view) store("ot_demo_view", d.view); return { token: "demo" }; }
      case "unpublish": return { ok: true };
      case "deck": return recall("ot_demo_view") || clone(tape.deck.view);
    }
    return { error: "Unknown action" };
  }
  return { api, load, get tape() { return tape; } };
})();
if (window.DEMO) document.documentElement.classList.add("is-demo");
