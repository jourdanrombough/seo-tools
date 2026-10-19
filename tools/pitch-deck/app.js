/* SEO Pitch Deck Generator
   research (traffic gap scan in a frame + authority + AI visibility + crawl) → work items (code) → 90-day plan (Claude)
   → pricing (code, from the rate card) → deck copy (Claude) → editor → private link, PowerPoint, PDF */
const $ = s => document.querySelector(s);
const { esc, fmt, usd, pct } = DK;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const normDomain = d => String(d || "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[\/?#].*$/, "");
const STATES = [["Alabama", "AL"], ["Alaska", "AK"], ["Arizona", "AZ"], ["Arkansas", "AR"], ["California", "CA"], ["Colorado", "CO"], ["Connecticut", "CT"], ["Delaware", "DE"], ["District of Columbia", "DC"], ["Florida", "FL"], ["Georgia", "GA"], ["Hawaii", "HI"], ["Idaho", "ID"], ["Illinois", "IL"], ["Indiana", "IN"], ["Iowa", "IA"], ["Kansas", "KS"], ["Kentucky", "KY"], ["Louisiana", "LA"], ["Maine", "ME"], ["Maryland", "MD"], ["Massachusetts", "MA"], ["Michigan", "MI"], ["Minnesota", "MN"], ["Mississippi", "MS"], ["Missouri", "MO"], ["Montana", "MT"], ["Nebraska", "NE"], ["Nevada", "NV"], ["New Hampshire", "NH"], ["New Jersey", "NJ"], ["New Mexico", "NM"], ["New York", "NY"], ["North Carolina", "NC"], ["North Dakota", "ND"], ["Ohio", "OH"], ["Oklahoma", "OK"], ["Oregon", "OR"], ["Pennsylvania", "PA"], ["Rhode Island", "RI"], ["South Carolina", "SC"], ["South Dakota", "SD"], ["Tennessee", "TN"], ["Texas", "TX"], ["Utah", "UT"], ["Vermont", "VT"], ["Virginia", "VA"], ["Washington", "WA"], ["West Virginia", "WV"], ["Wisconsin", "WI"], ["Wyoming", "WY"]];
const CC = { us: { code: 2840, iso: "US", name: "United States" }, uk: { code: 2826, iso: "GB", name: "United Kingdom" }, ca: { code: 2124, iso: "CA", name: "Canada" }, au: { code: 2036, iso: "AU", name: "Australia" } };

/* ---------- transport ---------- */
let MODE = "demo", NONCE = "", CLAUDE = false, LOGIN = null, RATES = DEFAULT_RATES, DECK = null, CRAWL = null, SCANS = [];
async function api(n, body, q) {
  if (window.DEMO) return DEMO.api(n, body, q);
  const o = { credentials: "same-origin", cache: "no-store", headers: { "X-OT-Nonce": NONCE } };
  if (body !== undefined) { o.method = "POST"; o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(body); }
  const r = await fetch("api.php?a=" + n + (q ? "&" + q : ""), o);
  const j = await r.json().catch(() => ({ error: "Bad response (" + r.status + ")" }));
  return j;
}
async function dfs(endpoint, task, label) {
  const t0 = performance.now();
  let r; try { r = await api("dfs", { endpoint, task }); } catch (e) { r = { status_code: 0, status_message: e.message }; }
  DECK.cost.dfs += r.cost || 0; costUI();
  DECK.calls.push({ label, endpoint, cost: r.cost || 0, s: +((performance.now() - t0) / 1000).toFixed(1), ok: r.status_code === 20000, cached: !!r.cached });
  return r.status_code === 20000 ? r.result : null;
}
async function ai(task, data, label) {
  if (!CLAUDE) return null;
  let r; try { r = await api("ai", { task, data, note: DECK.input.note }); } catch (e) { r = { ok: false, error: e.message }; }
  DECK.cost.claude += r.cost || 0; costUI();
  DECK.calls.push({ label, endpoint: "claude:" + task, cost: r.cost || 0, ok: !!r.ok, cached: !!r.cached });
  if (r.ok) { DECK.models = DECK.models || {}; DECK.models[task] = r.model; return r.json; }
  feed(`<h4>Claude</h4><div class="row"><span>${esc(label)}</span><span class="m">${esc(r.error || "no answer")} · using the built-in fallback</span></div>`);
  if (r.fallback && !/JSON/.test(r.error || "")) CLAUDE = false;
  return null;
}
function costUI() { if (DECK) $("#runCost").textContent = `DataForSEO $${DECK.cost.dfs.toFixed(3)} · Claude $${DECK.cost.claude.toFixed(3)}`; }
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2400); }
function showErr(m) { const e = $("#err"); e.textContent = m || ""; e.style.display = m ? "block" : "none"; }
function view(id) { document.querySelectorAll("section.view").forEach(s => s.classList.toggle("on", s.id === id)); window.scrollTo(0, 0); }

async function boot() {
  $("#fSt").innerHTML = `<option value="">Nationwide</option>` + STATES.map(([n, a]) => `<option value="${a}">${n}</option>`).join("");
  ["#fDomain", "#fKw", "#fSt"].forEach(s => $(s).addEventListener("change", reuseOptions));
  $("#fDomain").addEventListener("blur", reuseOptions);
  $("#fCrawl").addEventListener("change", async e => {
    const f = e.target.files[0]; CRAWL = null; if (!f) return estimate();
    try { CRAWL = await readCrawlFile(f); toast(`${CRAWL.source} crawl read: ${fmt(CRAWL.pages)} URLs, ${CRAWL.issues.length} issue types`); } catch (er) { showErr(er.message); e.target.value = ""; }
    estimate();
  });
  ["#fCc", "#fSt", "#fReuse", "#fCrawlN"].forEach(s => $(s).addEventListener("change", estimate));
  try {
    const h = await api("health");
    if (h.mode === "local") { MODE = "local"; NONCE = h.nonce || ""; CLAUDE = !!(h.keys && h.keys.claude); }
    else LOGIN = h.login;
  } catch (e) { }
  const m = $("#mode"); m.className = "chip " + (MODE === "local" ? "live" : ""); m.lastElementChild.textContent = window.DEMO ? "demo · recorded run" : MODE === "local" ? (CLAUDE ? "live · Claude" : "live · backup AI") : "not logged in";
  if (MODE !== "local" && LOGIN) { const b = $("#loginBtn"); b.style.display = ""; b.onclick = () => location.href = LOGIN; }
  if (window.DEMO) await demoSetup();
  if (MODE === "local") {
    const r = await api("rates"); if (r.rates && r.rates.tasks) RATES = r.rates;
    loadDecks(); try { SCANS = await api("list", undefined, "kind=scans"); if (!Array.isArray(SCANS)) SCANS = []; } catch (e) { }
  } else $("#decks").innerHTML = `<div class="empty">${LOGIN ? `<a href="${esc(LOGIN)}">Log in</a> to build and see decks.` : "Live decks run on optimizationtheory.com (logged in) or the dev server on your Mac."}</div>`;
  estimate();
  const h = location.hash.slice(1); if (h.startsWith("deck=") && MODE === "local") openDeck(h.slice(5));
}
async function demoSetup() {
  const T = await DEMO.load(), I = T.deck.input;
  $("#demoDom").textContent = I.domain; $("#demoDate").textContent = new Date(T.recorded).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  document.querySelectorAll('a[href="settings/"]').forEach(a => a.href = "settings/?demo=1");
  document.querySelectorAll('a[href="../traffic-gap/"]').forEach(a => a.href = "../traffic-gap/?demo=1");
  $("#fDomain").value = I.domain; $("#fBiz").value = I.business; $("#fContact").value = I.contact || ""; $("#fKw").value = I.keyword || ""; $("#fCc").value = I.cc; $("#fSt").value = I.st || "";
  $("#fEng").value = I.engagement; $("#fBudget").value = I.budget || ""; $("#fNote").value = I.note || ""; $("#fCrawlN").value = String(T.crawlN || 100);
  document.querySelectorAll("#form input, #form select, #form textarea").forEach(e => e.disabled = true);
  $("#form button[type=submit]").textContent = "Watch the deck get built ▸";
}
async function loadDecks() {
  const ds = await api("list", undefined, "kind=decks");
  $("#decks").innerHTML = Array.isArray(ds) && ds.length ? ds.map(d => `<div class="hrow" data-id="${esc(d.id)}"><div><b>${esc(d.business || d.domain)}</b><span>${esc(d.domain)} · ${esc((d.date || "").slice(0, 10))}${d.headline ? " · " + esc(d.headline) : ""}</span></div><span class="st ${d.status === "published" ? "pub" : ""}">${esc(d.status)}</span></div>`).join("") : `<div class="empty">Decks you build are saved here.</div>`;
  document.querySelectorAll(".hrow").forEach(r => r.onclick = () => openDeck(r.dataset.id));
}
function reuseOptions() {
  const d = normDomain($("#fDomain").value), sel = $("#fReuse"), cur = sel.value;
  const week = Date.now() - 7 * 864e5;
  const opts = SCANS.filter(s => s.domain === d && Date.parse(s.date) > week);
  sel.innerHTML = `<option value="">Run a new traffic gap scan</option>` + opts.map(s => `<option value="${esc(s.id)}">Reuse scan from ${esc(new Date(s.date).toLocaleDateString())} · ${esc(s.keyword || "site keywords")} · ${esc(s.location)}</option>`).join("");
  if (opts.length) { const st = $("#fSt").value, kw = $("#fKw").value.trim().toLowerCase(); const best = opts.find(s => (s.keyword || "") === kw && (s.region || "") === st) || (cur && opts.find(s => s.id === cur)); sel.value = best ? best.id : ""; }
  estimate();
}
function estimate() {
  const reuse = !!$("#fReuse").value, st = !!$("#fSt").value;
  const crawlN = CRAWL ? 0 : +$("#fCrawlN").value || 0;
  const dfsC = (reuse ? 0 : st ? .55 : .32) + .08 + .15 + .03 + crawlN * .00015, cl = CLAUDE ? .15 : 0;
  $("#est").innerHTML = `<span>⏱ <b>about ${reuse ? 1 : st ? 3 : 2} min</b></span><span>≈ <b>$${dfsC.toFixed(2)}</b> DataForSEO${CLAUDE ? ` + <b>$${cl.toFixed(2)}</b> Claude` : ""}</span>${CRAWL ? `<span>crawl: <b>your export, ${fmt(CRAWL.pages)} URLs · score ${CRAWL.score}</b></span>` : crawlN ? `<span>crawl: <b>up to ${crawlN} pages</b></span>` : ""}${MODE !== "local" ? `<span style="color:var(--gold)">log in to build decks</span>` : ""}`;
}
function goHome() { view("home"); history.replaceState(null, "", location.pathname); if (MODE === "local") loadDecks(); }

/* ---------- build ---------- */
const STEPS = [
  ["scan", "Traffic gap scan", "footprint, market, competitors, projection"],
  ["auth", "Link authority", "backlinks for you and the top competitors"],
  ["ai", "AI search check", "what ChatGPT and Google AI Overviews say"],
  ["crawl", "Site crawl", "DataForSEO crawls the site while the scan runs"],
  ["items", "Work items", "every finding priced from your rate card"],
  ["plan", "90-day plan", "Claude orders the work"],
  ["copy", "Deck copy", "Claude writes the slides"],
];
function stepsUI(cur, done, skip = []) {
  $("#steps").innerHTML = STEPS.map(([id, t, s]) => `<div class="stp ${done.includes(id) ? "done" : id === cur ? "on" : ""} ${skip.includes(id) ? "skip" : ""}"><i>${done.includes(id) ? "✓" : ""}</i><div><b>${t}</b><small>${skip.includes(id) ? "skipped" : s}</small></div></div>`).join("");
  const st = STEPS.find(s => s[0] === cur); $("#runHead").textContent = st ? st[1] + "…" : "Done";
}
function feed(html) { const d = document.createElement("div"); d.className = "fc"; d.innerHTML = html; $("#feed").prepend(d); }

async function build() {
  showErr("");
  if (MODE !== "local") { if (LOGIN) location.href = LOGIN; return showErr("Log in on optimizationtheory.com to build decks."); }
  const domain = normDomain($("#fDomain").value);
  if (!domain.includes(".")) return showErr("Enter a domain like example.com");
  const st = $("#fSt").value, stName = (STATES.find(s => s[1] === st) || [])[0] || null, cc = $("#fCc").value;
  DECK = {
    v: 1, created: new Date().toISOString(), status: "draft",
    input: { domain, business: $("#fBiz").value.trim() || domain, contact: $("#fContact").value.trim(), keyword: $("#fKw").value.trim().toLowerCase(), cc, st, stName, engagement: $("#fEng").value, budget: $("#fBudget").value.trim(), note: $("#fNote").value.trim().slice(0, 600), reuse: $("#fReuse").value || null },
    research: {}, cost: { dfs: 0, claude: 0 }, calls: [],
  };
  if (CRAWL) DECK.research.crawl = CRAWL;
  view("run"); $("#feed").innerHTML = ""; costUI();
  const crawlN = CRAWL ? 0 : +$("#fCrawlN").value || 0;
  if (crawlN) await startCrawl(domain, crawlN);
  const done = [], skip = [];
  try {
    // 1. scan (in the scanner's own page, so you see the animation)
    stepsUI("scan", done);
    const D = await runScan(); DECK.research.digest = D; if (!D.reused) { DECK.cost.dfs += D.cost || 0; DECK.cost.claude += D.aiCost || 0; } costUI(); done.push("scan");
    feed(`<h4>Traffic gap</h4><div class="row"><span>Visits today</span><b>${fmt(D.you.visits)}</b></div><div class="row"><span>Going to competitors</span><b class="n">${fmt(D.missing.visits)}</b></div><div class="row"><span>Realistic 12-month gain</span><b class="y">+${fmt(D.scenarios.exp.gain)}</b></div>`);
    $("#frame").style.height = "320px";
    // 2. authority
    stepsUI("auth", done, skip);
    const auth = await runAuthority(D); if (auth) DECK.research.authority = auth; else skip.push("auth"); done.push("auth");
    // 3. AI visibility
    stepsUI("ai", done, skip);
    DECK.research.ai = await runAI(D); done.push("ai");
    // 4. crawl
    stepsUI("crawl", done, skip);
    if (!CRAWL && DECK.research.crawlTask) { const c = await finishCrawl(); if (c) DECK.research.crawl = c; }
    const CR = DECK.research.crawl;
    if (CR) feed(`<h4>Site health · ${esc(CR.source)}${CR.partial ? " (partial)" : ""}</h4><div class="row"><span>Health score · ${fmt(CR.pages)} pages</span><b class="${CR.score >= 80 ? "y" : CR.score >= 60 ? "m" : "n"}">${CR.score}/100</b></div>${CR.issues.slice(0, 4).map(i => `<div class="row"><span>${esc(i.label)}</span><b>${fmt(i.count)}</b></div>`).join("")}`); else skip.push("crawl");

    done.push("crawl"); await sleep(window.DEMO ? 250 : 400);
    // 5. items
    stepsUI("items", done, skip);
    DECK.items = buildItems(); await sleep(500);
    feed(`<h4>Work items</h4>${DECK.items.slice(0, 8).map(i => `<div class="row"><span>${esc(i.name)}${i.qty > 1 ? " × " + i.qty : ""}</span><b>${usd(i.price)}</b></div>`).join("")}${DECK.items.length > 8 ? `<div class="row"><span>+ ${DECK.items.length - 8} more</span><span></span></div>` : ""}`);
    done.push("items");
    // 6. plan
    stepsUI("plan", done, skip);
    await makePlan(); done.push("plan");
    DECK.pricing = price();
    feed(`<h4>Plan and price</h4><div class="row"><span>One-time</span><b>${usd(DECK.pricing.oneTime)}</b></div>${DECK.pricing.tier ? `<div class="row"><span>Monthly · ${esc(DECK.pricing.tier.name)}</span><b>${usd(DECK.pricing.tier.price)}/mo</b></div>` : ""}`);
    // 7. copy
    stepsUI("copy", done, skip);
    await writeCopy(); done.push("copy"); stepsUI("", done, skip);
    DECK.headline = `${usd(DECK.pricing.oneTime)}${DECK.pricing.tier ? " + " + usd(DECK.pricing.tier.price) + "/mo" : ""} · +${fmt(D.scenarios.exp.gain)} visits/mo`;
    await saveDeck();
    await sleep(600);
    openEditor();
  } catch (e) { console.error(e); feed(`<h4>Stopped</h4><div class="row"><span class="n">${esc(e.message)}</span></div>`); $("#runHead").innerHTML = `Stopped · <a href="#" onclick="goHome();return false">back</a>`; }
}

/* DataForSEO On-Page crawl: started first so it runs while the scan does, then read with on_page/summary */
async function startCrawl(domain, n) {
  let r; try { r = await api("dfs", { endpoint: "on_page/task_post", task: { target: domain, max_crawl_pages: n, load_resources: false, enable_javascript: false, store_raw_html: false } }); } catch (e) { r = { status_code: 0, status_message: e.message }; }
  DECK.cost.dfs += r.cost || 0; costUI();
  DECK.calls.push({ label: "Site crawl: " + domain, endpoint: "on_page/task_post", cost: r.cost || 0, ok: !!r.id, cached: !!r.cached });
  if (r.id) { DECK.research.crawlTask = { id: r.id, n, started: Date.now() }; feed(`<h4>Site crawl</h4><div class="row"><span>DataForSEO is crawling ${esc(domain)} (up to ${n} pages) while the research runs</span><span class="m">started</span></div>`); }
  else feed(`<h4>Site crawl</h4><div class="row"><span>Couldn't start the crawl: ${esc(r.status_message || "error")}</span><span class="m">skipped</span></div>`);
}
async function finishCrawl() {
  const T = DECK.research.crawlTask, until = Date.now() + (window.DEMO ? 600e3 : 150e3);
  let last = null;
  while (true) {
    let r; try { r = await api("dfs", { endpoint: "on_page/summary/" + T.id, task: {} }); } catch (e) { r = {}; }
    const s = r.status_code === 20000 && r.result && r.result[0];
    if (s) {
      last = s; const cs = s.crawl_status || {};
      $("#runHead").textContent = `Site crawl… ${fmt(cs.pages_crawled || 0)} pages crawled${s.crawl_progress === "finished" ? "" : ", " + fmt(cs.pages_in_queue || 0) + " in the queue"}`;
      if (s.crawl_progress === "finished") break;
    }
    if (r && r._last) break; // demo: end of the recording
    if (Date.now() > until) break;
    await sleep(window.DEMO ? 1200 : 6000);
  }
  if (!last || !(last.crawl_status && last.crawl_status.pages_crawled)) { feed(`<h4>Site crawl</h4><div class="row"><span>The crawl didn't return pages in time</span><span class="m">skipped</span></div>`); return null; }
  const c = crawlFromSummary(last, T.n);
  if (window.DEMO) { c.source = "Sample crawl"; c.partial = false; }
  return c;
}

function runScan() {
  const I = DECK.input;
  return new Promise((ok, bad) => {
    const q = I.reuse ? `embed=1&scan=${encodeURIComponent(I.reuse)}&replay=1` : `embed=1&d=${encodeURIComponent(I.domain)}&kw=${encodeURIComponent(I.keyword)}&cc=${I.cc}&st=${I.st}&note=${encodeURIComponent(I.note)}`;
    $("#frame").style.height = ""; $("#frame").innerHTML = `<iframe src="../traffic-gap/?${q}${window.DEMO ? "&demo=1" : ""}" title="Traffic gap scan"></iframe>`;
    const to = setTimeout(() => { removeEventListener("message", on); bad(new Error("The scan took too long. Try again, or reuse a saved scan.")); }, 8 * 60e3);
    function on(e) {
      if (e.origin !== location.origin || !e.data || !e.data.type) return;
      if (e.data.type === "ot-scan") { clearTimeout(to); removeEventListener("message", on); const d = e.data.digest; d.reused = !!I.reuse; ok(d); }
      if (e.data.type === "ot-scan-error") { clearTimeout(to); removeEventListener("message", on); bad(new Error(e.data.error)); }
    }
    addEventListener("message", on);
  });
}

async function runAuthority(D) {
  const BIG = /(^|\.)(facebook|instagram|youtube|reddit|wikipedia|quora|medium|x|twitter|linkedin|pinterest|tiktok|amazon|google|yelp|apple)\.(com|org)$/;
  const peers = D.comps.filter(c => !BIG.test(c.d) && c.type !== "media");
  const direct = peers.filter(c => c.type === "direct");
  const list = [D.domain, ...(direct.length >= 2 ? direct : peers).slice(0, 3).map(c => c.d)];
  const res = await Promise.all(list.map(d => dfs("backlinks/summary/live", { target: d, include_subdomains: true }, "Backlinks: " + d)));
  if (!res[0]) { feed(`<h4>Link authority</h4><div class="row"><span>Backlinks data isn't available on this DataForSEO plan</span><span class="m">skipped</span></div>`); return null; }
  const out = list.map((d, j) => { const r = res[j]?.[0] || {}; return { d, rank: r.rank || 0, refd: r.referring_main_domains || r.referring_domains || 0, links: r.backlinks || 0 }; });
  feed(`<h4>Link authority</h4>${out.map(a => `<div class="row"><span>${esc(a.d)}</span><b>${fmt(a.refd)} referring domains</b></div>`).join("")}`);
  return out;
}

async function runAI(D) {
  const I = DECK.input, where = I.stName || "";
  let qs = null;
  const j = await ai("questions", { business: I.business, domain: D.domain, what_it_is: D.ai?.biz, services: D.ai?.services, serves: where || CC[I.cc].name, local: !!I.st }, "Claude: buyer questions");
  if (j && Array.isArray(j.questions)) qs = j.questions.map(String).filter(Boolean).slice(0, 5);
  if (!qs || !qs.length) {
    const svc = (D.ai?.services || []).concat(I.keyword ? [I.keyword] : []).filter(Boolean);
    const s0 = I.keyword || svc[0] || D.topics[0]?.name || "this service";
    qs = [`Who is the best ${s0}${where ? " in " + where : ""}?`, `Recommend a good ${s0}${where ? " near " + where : ""}`, ...svc.slice(0, 3).map(s => `What should I look for when hiring for ${s}?`)].slice(0, 5);
  }
  const brand = I.business.toLowerCase().replace(/\b(llc|inc|co|ltd|pllc|pc)\b\.?/g, "").trim(), root = D.domain.split(".")[0];
  const names = [brand, D.domain, root.length >= 5 ? root : null].filter(n => n && n.length >= 4);
  const comps = D.comps.filter(c => c.type === "direct").slice(0, 6).map(c => c.d);
  const answers = await Promise.all(qs.map(async q => {
    const r = await dfs("ai_optimization/chat_gpt/llm_responses/live", { user_prompt: q.slice(0, 500), model_name: "gpt-5.4-mini", web_search: true, web_search_country_iso_code: CC[I.cc].iso }, "ChatGPT: " + q.slice(0, 40));
    let text = "", cites = [];
    (r?.[0]?.items || []).forEach(it => (it.sections || []).forEach(s => { if (s.type === "text") { text += s.text || ""; (s.annotations || []).forEach(a => { if (a.url) cites.push(normDomain(a.url)); }); } }));
    if (!text) return null;
    const low = text.toLowerCase();
    return { engine: "ChatGPT", q, mentioned: names.some(n => low.includes(n)), cited: cites.some(c => c === D.domain || c.endsWith("." + D.domain)), top: [...new Set(cites)].slice(0, 5), comps: comps.filter(c => low.includes(c) || low.includes(c.split(".")[0])) };
  }));
  const A = answers.filter(Boolean);
  // Google AI Overviews on the 3 biggest searches
  const kws = (D.opportunities || []).slice().sort((a, b) => b.v - a.v).slice(0, 3).map(x => x.k);
  const loc = I.st && D.location.serp ? { location_name: D.location.serp } : { location_code: CC[I.cc].code };
  let aio = 0, aioYou = 0, aioChecked = 0;
  await Promise.all(kws.map(async k => {
    const r = await dfs("serp/google/organic/live/advanced", { keyword: k, language_code: "en", depth: 10, load_async_ai_overview: true, ...loc }, "Google AI Overview: " + k);
    if (!r) return; aioChecked++;
    const it = (r[0]?.items || []).find(x => x.type === "ai_overview"); if (!it) return;
    aio++;
    const refs = (it.references || []).map(x => normDomain(x.domain || x.url));
    const you = refs.some(d => d === D.domain || d.endsWith("." + D.domain));
    if (you) aioYou++;
    A.push({ engine: "Google AI Overview", q: k, mentioned: you, cited: you, top: [...new Set(refs)].slice(0, 5), comps: [] });
  }));
  const seen = A.filter(a => a.mentioned || a.cited).length;
  feed(`<h4>AI search</h4>${A.slice(0, 6).map(a => `<div class="row"><span>${esc(a.engine)}: ${esc(a.q)}</span><b class="${a.cited || a.mentioned ? "y" : "n"}">${a.cited ? "cited" : a.mentioned ? "mentioned" : "not there"}</b></div>`).join("")}`);
  return { answers: A, checked: A.length, seen, aio, aioYou, aioChecked, questions: qs };
}

/* ---------- work items: every finding becomes priced line items (code, not AI) ---------- */
function task(id) { return RATES.tasks.find(t => t.id === id); }
let LINE_N = 0; // deterministic line ids, so a recorded demo replays exactly
function lineFor(id, qty, extra) {
  const t = task(id); if (!t) return null;
  qty = Math.max(1, Math.round(qty || 1));
  const unitPrice = t.price != null && t.price !== "" ? +t.price : +(t.hours || 0) * RATES.hourly;
  const q = t.unit === "fixed" ? 1 : qty;
  return { key: id + "-" + (++LINE_N), task: id, cat: t.cat, name: t.name, unit: t.unit, qty: q, unitPrice: Math.round(unitPrice * 100) / 100, hours: t.hours ? +(t.hours * q).toFixed(2) : null, price: Math.round(unitPrice * q), month: 1, on: true, ...extra };
}
function buildItems() {
  const D = DECK.research.digest, C = DECK.research.crawl, A = DECK.research.ai, AU = DECK.research.authority, I = DECK.input;
  LINE_N = 0;
  const L = [], add = (id, qty, finding, ex = {}) => { const l = lineFor(id, qty, { finding, ...ex }); if (l) L.push(l); return l; };
  const ex = D.scenarios.exp;
  // technical
  if (C) {
    const by = Object.fromEntries(C.issues.map(i => [i.key, i.count]));
    const tm = (by.missing_title || 0) + (by.missing_meta || 0) + (by.dup_title || 0) + (by.title_long || 0);
    if (tm) add("fix_titles", Math.min(tm, 300), `${fmt(tm)} pages with missing or duplicate titles and descriptions`);
    if (by.missing_h1) add("fix_h1", Math.min(by.missing_h1, 300), `${fmt(by.missing_h1)} pages with no H1`);
    const br = (by.errors || 0) + (by.broken_links || 0);
    if (br) add("fix_errors", Math.min(br, 200), `${fmt(br)} broken pages and links`);
    if (by.no_sitemap || by.no_robots) add("sitemap", 1, by.no_sitemap ? "No XML sitemap found" : "No robots.txt file");
    if (by.no_https || by.mixed) add("https", 1, by.no_https ? "HTTPS isn't enforced" : `${fmt(by.mixed)} pages link to HTTP URLs`);
    if (by.missing_alt) add("alt_text", Math.min(by.missing_alt, 150), `${fmt(by.missing_alt)} pages have images with no alt text`, { on: false, optional: true });
    if (by.redirects) add("fix_redirects", Math.min(by.redirects, 400), `${fmt(by.redirects)} internal redirects`);
    const ix = (by.noindex || 0) + (by.canonicalized || 0) + (by.dup_content || 0); if (ix) add("fix_index", Math.min(ix, 400), `${fmt(ix)} noindex or canonicalized pages to review`);
    if (by.thin) add("thin", Math.min(by.thin, 15), `${fmt(by.thin)} thin pages under 300 words`);
    if (by.slow || by.render_blocking) add("speed", 1, by.slow ? `${fmt(by.slow)} pages load slowly` : `${fmt(by.render_blocking)} pages have render-blocking files`);
    if (by.deep || by.orphan) add("internal_links", 1, by.orphan ? `${fmt(by.orphan)} pages have no internal links pointing in` : `${fmt(by.deep)} pages buried 4+ clicks deep`);
  } else add("tech_audit", 1, "No crawl yet, so the plan starts with a full technical audit");
  add("ga4", 1, "Measure the gains from day one", { on: false, optional: true });
  // striking distance
  if (D.striking >= 8) add("quickwin", 1, `${fmt(D.striking)} searches already rank 4 to 20`, { impact: ex.push.visits });
  else if (D.striking > 0) add("onpage", D.striking, `${fmt(D.striking)} searches already rank 4 to 20`, { impact: ex.push.visits });
  // keyword gaps → new pages
  const tps = D.topics.filter(t => t.pot > 0).sort((a, b) => b.pot - a.pot), totalPot = tps.reduce((a, t) => a + t.pot, 0) || 1;
  const skipT = /^(questions|near me|costs & fees|free consultation|best & top rated|towns & counties|cities & towns)$/;
  const pages = tps.filter(t => !skipT.test(t.name) && t.name !== D.keyword && t.top && t.top.length && t.pot >= Math.max(15, totalPot * .03)).slice(0, 5);
  pages.forEach(t => add("new_page", 1, `${fmt(t.pot)} visits a month open across ${fmt(t.n)} "${t.name}" searches${t.lead ? `, led by ${t.lead}` : ""}`, { name: `New page for "${t.top[0].k}"`, impact: Math.round(t.pot * .4) }));
  const core = tps.find(t => t.name === D.keyword);
  if (core && core.pot > 0 && !L.some(l => l.task === "quickwin")) add("onpage", Math.min(10, Math.max(2, core.top.length)), `The core "${core.name}" searches still have ${fmt(core.pot)} visits a month open`, { name: `Strengthen the main ${core.name} pages`, impact: Math.round(core.pot * .3) });
  const qt = tps.find(t => t.name === "questions" || t.name === "costs & fees");
  if (qt) add("blog", 4, `Buyers ask ${fmt(qt.n)} questions in "${qt.name}" and others answer them`, { name: `Blog posts answering ${qt.name}`, impact: Math.round(qt.pot * .3) });
  if (!L.some(l => l.task === "internal_links") && pages.length) add("internal_links", 1, "Link the new pages from the pages that already rank");
  // local
  if (I.st && D.local) {
    if (D.mapPacks && !D.mapPacksYou) add("gbp_setup", 1, `Map packs show on ${D.mapPacks} of the top searches and you're in none`, { impact: ex.map.visits });
    add("citations", 1, "Consistent listings support the map pack");
    const lt = tps.find(t => /towns|cities/.test(t.name));
    if (lt) add("local_page", Math.min(5, Math.max(2, lt.top.length)), `${fmt(lt.n)} searches name nearby towns`, { impact: Math.round(lt.pot * .4) });
  }
  if (!C || I.st) add("schema", 1, "Structured data for services, reviews and location");
  // AI visibility
  if (A && A.checked) {
    if (A.seen < Math.ceil(A.checked / 2)) { add("llms", 1, `AI answers mention you in ${A.seen} of ${A.checked} checks`); add("faq", 1, "Answer-style content gives AI assistants something to quote"); }
    add("ai_audit", 1, "Deeper tracking across 6 AI platforms", { on: false, optional: true });
  }
  // links
  if (AU && AU.length > 1) {
    const me = AU[0].refd, best = Math.max(...AU.slice(1).map(a => a.refd));
    if (best > me * 1.5) add(best > 300 ? "link_dr40" : "link_dr20", 6, `${fmt(me)} referring domains vs ${fmt(best)} for the leader`);
  }
  // default schedule (Claude refines it)
  const pageIdx = {}; let np = 0;
  L.forEach(l => {
    if (l.cat === "technical" || l.cat === "tracking" || l.task === "quickwin" || l.task === "onpage") l.month = 1;
    else if (l.task === "new_page") { l.month = np < 2 ? 2 : 3; np++; }
    else if (l.cat === "local") l.month = 2;
    else l.month = 3;
  });
  return L;
}

/* ---------- plan: Claude picks and orders; code checks every id and price ---------- */
function parseBudget(s) { const m = String(s || "").replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)\s*(k)?/i); return m ? +m[1] * (m[2] ? 1000 : 1) : 0; }
function defaultTier() {
  const I = DECK.input, D = DECK.research.digest, b = parseBudget(I.budget);
  if (I.engagement === "project") return null;
  const seo = RATES.tiers.filter(t => t.track === "seo").sort((a, b) => a.price - b.price);
  if (b) { const fit = RATES.tiers.filter(t => t.price <= b * 1.1 && (t.track === "seo" || (t.track === "local" && I.st))).sort((x, y) => y.price - x.price)[0]; if (fit) return fit.id; }
  const g = D.scenarios.exp.gain;
  return (g < 300 ? seo[0] : g < 1500 ? seo[1] || seo[0] : seo[2] || seo[seo.length - 1]).id;
}
async function makePlan() {
  const D = DECK.research.digest, I = DECK.input, items = DECK.items;
  const j = await ai("plan", {
    prospect: { business: I.business, domain: I.domain, what_it_is: D.ai?.biz, location: I.stName || CC[I.cc].name },
    engagement: I.engagement, budget_hint: I.budget || null, hourly_rate: RATES.hourly,
    findings: { visits_today: D.you.visits, visits_to_competitors: D.missing.visits, realistic_12_month_gain: D.scenarios.exp.gain, searches_ranked_4_to_20: D.striking, searches_not_on_page_one: D.notYours.n, biggest_gaps: D.topics.slice(0, 6).map(t => ({ topic: t.name, visits_open: t.pot, leader: t.lead })), leader: D.leader, ai_answers_mentioning_you: DECK.research.ai ? `${DECK.research.ai.seen} of ${DECK.research.ai.checked}` : null, crawl_health: DECK.research.crawl ? DECK.research.crawl.score : null, authority: DECK.research.authority || null },
    items: items.map(l => ({ id: l.key, name: l.name, category: l.cat, price: l.price, qty: l.qty, finding: l.finding, est_visits: l.impact || null, optional: !!l.optional })),
    tiers: I.engagement === "project" ? [] : RATES.tiers.map(t => ({ id: t.id, name: t.name, track: t.track, price_per_month: t.price, includes: t.includes })),
  }, "Claude: build the 90-day plan");
  const P = { tier: defaultTier(), summary: "", tierWhy: "", by: "rules" };
  if (j && Array.isArray(j.items)) {
    const keys = new Set(items.map(l => l.key)), chosen = new Map();
    j.items.forEach(x => { if (keys.has(x.id) && !chosen.has(x.id)) chosen.set(x.id, { month: Math.min(4, Math.max(1, Math.round(+x.month || 1))), why: String(x.why || "").slice(0, 160) }); });
    if (chosen.size >= Math.min(3, items.length)) {
      items.forEach(l => { const c = chosen.get(l.key); l.on = !!c; if (c) { l.month = c.month; l.why = c.why; } });
      P.by = "claude";
    }
    if (I.engagement !== "project" && RATES.tiers.some(t => t.id === j.tier)) P.tier = j.tier;
    if (I.engagement === "project") P.tier = null;
    P.summary = String(j.summary || "").slice(0, 400); P.tierWhy = String(j.tier_why || "").slice(0, 200);
  }
  if (I.engagement === "project") items.forEach(l => { if (l.month > 3) l.month = 3; });
  DECK.plan = P;
  feed(`<h4>90-day plan · ${P.by === "claude" ? "by Claude" : "rule-based"}</h4>${[1, 2, 3, 4].map(m => { const n = items.filter(l => l.on && l.month === m).length; return n ? `<div class="row"><span>${m === 4 ? "Ongoing" : "Month " + m}</span><b>${n} item${n > 1 ? "s" : ""}</b></div>` : ""; }).join("")}`);
}

/* ---------- pricing (code) ---------- */
function price() {
  const I = DECK.input, eng = DECK.engagement || I.engagement, lines = DECK.items.filter(l => l.on);
  const ongoing = l => l.month === 4 && eng !== "project";
  let sum = lines.filter(l => !ongoing(l)).reduce((a, l) => a + l.price, 0), note = "";
  let oneTime = sum ? Math.ceil(sum / (RATES.roundTo || 1)) * (RATES.roundTo || 1) : 0;
  if (oneTime && oneTime < RATES.minimum) { oneTime = RATES.minimum; note = `Minimum project size of ${usd(RATES.minimum)} applies.`; }
  const tier = eng === "project" ? null : RATES.tiers.find(t => t.id === DECK.plan.tier) || RATES.tiers.find(t => t.id === defaultTier());
  if (eng === "monthly") { note = "The foundation work is included in the monthly plan's first 90 days."; }
  return {
    engagement: eng, oneTime: eng === "monthly" ? 0 : oneTime, listTotal: sum, note, hours: +lines.reduce((a, l) => a + (l.hours || 0), 0).toFixed(1),
    tier: tier ? { id: tier.id, name: tier.name, price: tier.price, includes: tier.includes } : null,
    lines: lines.map(l => ({ name: l.name, qty: l.qty, price: eng === "monthly" ? 0 : l.price, monthly: ongoing(l), included: eng === "monthly" })).sort((a, b) => b.price - a.price),
  };
}
function roi(pr) {
  const D = DECK.research.digest, R = DECK.roi || { leadRate: RATES.roi.leadRate, leadValue: RATES.roi.leadValue };
  const ex = D.scenarios.exp, base = D.you.visits, gain = ex.gain;
  const leads = gain * (R.leadRate || 0), value = leads * (R.leadValue || 0);
  let payback = null;
  if (value > 0) {
    let cost = pr.oneTime, got = 0;
    for (let m = 1; m <= 36; m++) { cost += pr.tier ? pr.tier.price : 0; got += ((ex.months[Math.min(12, m)] || 0) - base) * R.leadRate * R.leadValue; if (got >= cost) { payback = m; break; } }
  }
  return { leadRate: R.leadRate || 0, leadValue: R.leadValue || 0, leads: Math.round(leads * 10) / 10, value: Math.round(value), payback };
}

/* ---------- copy: Claude writes, code fills the numbers ---------- */
function fallbackCopy() {
  const D = DECK.research.digest, I = DECK.input, A = DECK.research.ai, P = DECK.pricing, lead = D.leader;
  const biz = I.business;
  return {
    cover: { headline: `How ${biz} wins more of its search market`, body: `A search growth plan built from live Google data for ${I.domain}.` },
    opportunity: { headline: `${fmt(D.missing.visits)} visits a month go to competitors`, body: `People search for what you offer across ${fmt(D.market.searches)} different searches. Most of those clicks land on other sites today.` },
    today: { headline: D.you.visits ? `You get ${fmt(D.you.visits)} visits a month from this market` : "Right now this market barely sees you", body: `${fmt(D.striking)} of your searches sit on positions 4 to 20, close enough that a focused push moves them into the top 3.` },
    competitors: { headline: lead ? `${lead.d} takes the biggest share` : "A few sites take most of the clicks", body: `Together the top five competitors take ${pct(D.comps.slice(0, 5).reduce((a, c) => a + c.share, 0), 0)} of the clicks. You take ${pct(D.you.share)}.` },
    gap: { headline: "The biggest groups of searches you're missing", body: `Each bar is a group of related searches and the visits a month you'd gain by reaching the top 3.` },
    ai: { headline: A && A.seen ? `AI assistants mention you in ${A.seen} of ${A.checked} answers` : "AI assistants don't recommend you yet", body: "More buyers ask ChatGPT and Google's AI before they search. These are the answers they get today." },
    health: { headline: "What's holding the site back", body: "These issues come straight from the crawl. Fixing them first makes every other improvement count." },
    plan: { headline: "The first 90 days, month by month", body: DECK.plan.summary || "Fix what blocks rankings first, then push the pages closest to page one, then build pages for the biggest gaps." },
    investment: { headline: "What it costs", body: "Every line is priced from the published rate card. No setup fees, month to month." },
    roi: { headline: `+${fmt(D.scenarios.exp.gain)} visits a month within a year`, body: "Projected from Google's click-through rates at each position. The dashed lines show the conservative and aggressive cases." },
    why: { headline: `Why ${RATES.agency.name}`, body: "" },
    next: { headline: "Let's pick the first three fixes together", body: "A 30-minute call to walk through the plan and agree on where to start." },
  };
}
async function writeCopy() {
  const D = DECK.research.digest, I = DECK.input, A = DECK.research.ai, P = DECK.pricing, r = roi(P);
  const fb = fallbackCopy();
  const j = await ai("deck", {
    prospect: { business: I.business, contact: I.contact || null, domain: I.domain, what_it_is: D.ai?.biz, location: I.stName || CC[I.cc].name },
    consultant: { name: RATES.agency.person, company: RATES.agency.name },
    facts: {
      visits_today: D.you.visits, share_of_clicks: pct(D.you.share), market_searches: D.market.searches, market_visits: D.market.visits, visits_to_competitors: D.missing.visits,
      realistic_12_month_gain: D.scenarios.exp.gain, full_potential_gain: D.full.visits, searches_ranked_4_to_20: D.striking, searches_not_on_page_one: D.notYours.n,
      leader: D.leader, top_competitors: D.comps.slice(0, 5).map(c => ({ domain: c.d, share: pct(c.share), type: c.type })),
      biggest_gaps: D.topics.slice(0, 5).map(t => ({ topic: t.name, visits_open: t.pot, leader: t.lead })),
      ai: A ? { answers_checked: A.checked, answers_mentioning_you: A.seen, ai_overviews: A.aio, ai_overviews_citing_you: A.aioYou } : null,
      crawl: DECK.research.crawl ? { health_score: DECK.research.crawl.score, top_issues: DECK.research.crawl.issues.slice(0, 4).map(i => `${i.label}: ${i.count}`) } : null,
      plan_summary: DECK.plan.summary || null, plan_months: [1, 2, 3, 4].map(m => DECK.items.filter(l => l.on && l.month === m).map(l => l.name)),
      leads_per_month_gain: r.leadRate ? r.leads : null,
    },
    rules: "Don't state prices; the investment slide shows them. The why slide body can be empty. The cover headline is the promise of the plan, not a number.",
  }, "Claude: write the deck");
  const out = {};
  Object.keys(fb).forEach(k => { const c = j?.slides?.[k]; out[k] = { headline: (c && c.headline ? String(c.headline) : fb[k].headline).slice(0, 140), body: (c && typeof c.body === "string" ? c.body : fb[k].body).slice(0, 320), on: true }; });
  DECK.copy = out; DECK.copyBy = j ? "claude" : "rules";
}

/* ---------- the view (what the deck renders and what gets published) ---------- */
function monthLabels(date) { const d0 = new Date(date); return [...Array(13)].map((_, m) => { if (!m) return "Now"; const d = new Date(d0.getFullYear(), d0.getMonth() + m, 1); return d.toLocaleString("en-US", { month: "short" }); }); }
function buildView() {
  const D = DECK.research.digest, I = DECK.input, A = DECK.research.ai, C = DECK.research.crawl;
  DECK.pricing = price();
  const months = [1, 2, 3, 4].map(m => ({ m, title: m === 4 ? "Ongoing" : "Month " + m, items: DECK.items.filter(l => l.on && l.month === m).map(l => ({ name: l.name + (l.qty > 1 ? ` × ${l.qty}` : ""), why: (l.why || l.finding || "").slice(0, 90) })) }));
  const pick = ({ name, includes, price, id }) => ({ id, name, includes, price });
  return {
    v: 1, date: DECK.created, theme: DECK.theme || RATES.theme || "google", agency: { ...RATES.agency },
    prospect: { domain: I.domain, business: I.business, contact: I.contact, location: I.stName || CC[I.cc].name },
    slides: DECK.copy,
    data: {
      today: { visits: D.you.visits, share: D.you.share, kw10: D.you.kw10, kw3: D.you.kw3 },
      market: D.market, missing: D.missing.visits, notYours: D.notYours, striking: D.striking, full: D.full.visits,
      gain12: D.scenarios.exp.gain, months: D.scenarios.exp.months, monthsCons: D.scenarios.cons.months, monthsAgg: D.scenarios.agg.months, monthLabels: monthLabels(DECK.created),
      leader: D.leader, comps: D.comps.slice(0, 6), topics: D.topics.filter(t => t.pot > 0).sort((a, b) => b.pot - a.pot).slice(0, 6).map(t => ({ name: t.name, n: t.n, pot: t.pot, lead: t.lead })),
      ai: A ? { answers: A.answers.map(a => ({ engine: a.engine, q: a.q, mentioned: a.mentioned, cited: a.cited, top: a.top })), checked: A.checked, seen: A.seen, aio: A.aioChecked ? A.aio : null, aioYou: A.aioYou, aioChecked: A.aioChecked } : null,
      health: C ? { score: C.score, pages: C.pages, issues: C.issues.map(i => ({ label: i.label, why: i.why, count: i.count, sev: i.sev })) } : null,
      plan: { months, summary: DECK.plan.summary },
      pricing: { ...DECK.pricing, tier: DECK.pricing.tier ? pick(DECK.pricing.tier) : null },
      roi: roi(DECK.pricing), authority: DECK.research.authority || null,
    },
  };
}

/* ---------- editor ---------- */
function openEditor() {
  DECK.view = buildView();
  view("edit"); location.hash = DECK.id ? "deck=" + DECK.id : "";
  $("#edTitle").textContent = `${DECK.input.business} · ${DECK.input.domain}`;
  DK.render(DECK.view, $("#deck"), { edit: true, static: true });
  wireDeck();
  panel();
  pubBox();
}
function rerender() { DECK.view = buildView(); const y = scrollY; DK.render(DECK.view, $("#deck"), { edit: true, static: true }); wireDeck(); scrollTo(0, y); totals(); DIRTY = true; }
let DIRTY = false;
function wireDeck() {
  $("#deck").querySelectorAll("[contenteditable]").forEach(el => el.addEventListener("input", () => { const s = el.dataset.s, f = el.dataset.f; DECK.copy[s][f] = el.innerText.trim(); DIRTY = true; }));
  $("#deck").querySelectorAll("[data-tog]").forEach(el => el.addEventListener("change", () => { DECK.copy[el.dataset.tog].on = el.checked; el.closest(".sl").classList.toggle("off", !el.checked); DIRTY = true; DECK.view = buildView(); }));
}
function totals() {
  const p = DECK.pricing, r = roi(p);
  $("#tot").innerHTML = `<div><b>${usd(p.oneTime)}</b><span>one-time${p.hours ? " · " + p.hours + " h" : ""}</span></div><div><b>${p.tier ? usd(p.tier.price) : "–"}</b><span>${p.tier ? "a month · " + esc(p.tier.name) : "no monthly plan"}</span></div><div><b>+${fmt(DECK.research.digest.scenarios.exp.gain)}</b><span>visits/mo in 12 months</span></div><div><b>${r.leadRate ? "+" + fmt(r.leads) : "–"}</b><span>${r.leadValue ? usd(r.value) + "/mo lead value" : "leads a month"}</span></div>`;
}
function panel() {
  const P = DECK.pricing;
  DECK.engagement = DECK.engagement || DECK.input.engagement;
  DECK.roi = DECK.roi || { leadRate: RATES.roi.leadRate, leadValue: RATES.roi.leadValue };
  $("#pTier").innerHTML = `<option value="">None</option>` + RATES.tiers.map(t => `<option value="${t.id}" ${P.tier && P.tier.id === t.id ? "selected" : ""}>${esc(t.name)} · ${usd(t.price)}</option>`).join("");
  $("#pTier").onchange = e => { DECK.plan.tier = e.target.value || null; if (!e.target.value && DECK.engagement !== "project") { DECK.engagement = "project"; $("#pEng").value = "project"; } rerender(); };
  $("#pEng").value = DECK.engagement; $("#pEng").onchange = e => { DECK.engagement = e.target.value; if (e.target.value !== "project" && !DECK.plan.tier) DECK.plan.tier = defaultTier() || "starter"; rerender(); panel(); };
  $("#pTheme").value = DECK.theme || RATES.theme || "google"; $("#pTheme").onchange = e => { DECK.theme = e.target.value; rerender(); };
  $("#pLead").value = +(DECK.roi.leadRate * 100).toFixed(2); $("#pVal").value = DECK.roi.leadValue || "";
  $("#pLead").onchange = e => { DECK.roi.leadRate = Math.max(0, +e.target.value || 0) / 100; rerender(); };
  $("#pVal").onchange = e => { DECK.roi.leadValue = Math.max(0, +e.target.value || 0); rerender(); };
  const ms = ["Month 1", "Month 2", "Month 3", "Ongoing"];
  $("#lines").innerHTML = DECK.items.map((l, j) => `<div class="li ${l.on ? "" : "off"}" data-j="${j}"><input type="checkbox" ${l.on ? "checked" : ""} data-k="on"><div class="nm">${esc(l.name)}<small>${esc(l.why || l.finding || "")}</small></div>${l.unit === "fixed" ? "<span></span>" : `<input type="number" min="1" value="${l.qty}" data-k="qty" title="quantity">`}<input type="number" min="0" step="10" value="${l.price}" data-k="price" title="price"><select data-k="month">${ms.map((m, i) => `<option value="${i + 1}" ${l.month === i + 1 ? "selected" : ""}>${m}</option>`).join("")}</select></div>`).join("");
  $("#lines").querySelectorAll(".li").forEach(row => row.querySelectorAll("[data-k]").forEach(inp => inp.addEventListener("change", () => {
    const l = DECK.items[+row.dataset.j], k = inp.dataset.k;
    if (k === "on") { l.on = inp.checked; row.classList.toggle("off", !l.on); }
    if (k === "qty") { l.qty = Math.max(1, Math.round(+inp.value || 1)); l.price = Math.round(l.unitPrice * l.qty); l.hours = task(l.task)?.hours ? +(task(l.task).hours * l.qty).toFixed(2) : null; row.querySelector('[data-k="price"]').value = l.price; }
    if (k === "price") { l.price = Math.max(0, Math.round(+inp.value || 0)); }
    if (k === "month") l.month = +inp.value;
    rerender();
  })));
  totals();
  const D = DECK.research.digest, A = DECK.research.ai, AU = DECK.research.authority;
  $("#rsum").innerHTML = `${esc(D.ai?.biz || "")}<br>Scan: ${esc(D.keyword || "site keywords")} · ${esc(D.location?.label || "")} · ${fmt(D.market.searches)} searches<br>AI check: ${A ? `${A.seen} of ${A.checked} answers mention them` : "not run"}<br>Authority: ${AU ? AU.map(a => `${esc(a.d)} ${fmt(a.refd)}`).join(", ") : "not available"}<br>Crawl: ${DECK.research.crawl ? DECK.research.crawl.score + "/100" : "none"}<br>Plan: ${DECK.plan.by === "claude" ? "Claude" : "rules"} · copy: ${DECK.copyBy === "claude" ? "Claude" : "built-in"}<br>Cost: DataForSEO $${DECK.cost.dfs.toFixed(3)} · Claude $${DECK.cost.claude.toFixed(3)}<br><a href="../traffic-gap/${window.DEMO ? "?demo=1" : ""}#show=scan:${esc(D.scanId || "")}" target="_blank">Open the full scan ▸</a>`;
}
async function saveDeck(manual) {
  DECK.view = DECK.view || (DECK.copy ? buildView() : null);
  const r = await api("save", { kind: "decks", id: DECK.id || undefined, data: DECK });
  if (r.id) { DECK.id = r.id; if (r.token) DECK.token = r.token; DIRTY = false; if (manual) toast("Saved"); if (location.hash !== "#deck=" + r.id && $("#edit").classList.contains("on")) history.replaceState(null, "", "#deck=" + r.id); }
  else toast("Couldn't save: " + (r.error || "error"));
}
function deckUrl() { return window.DEMO ? new URL("p/viewer.html?demo=1", location.href).href : new URL("p/?id=" + DECK.token, location.href).href; }
function pubBox() {
  const b = $("#pubBox");
  if (DECK.token && DECK.status === "published") { b.classList.add("on"); b.innerHTML = `<b style="color:var(--green)">Published</b>${DIRTY ? " · <span style='color:var(--gold)'>changes not live yet, publish again</span>" : ""}<br><a href="${esc(deckUrl())}" target="_blank">${esc(deckUrl())}</a><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" onclick="copyLink()">Copy link</button><button class="btn sm" onclick="unpublish()">Unpublish</button></div>`; }
  else b.classList.remove("on");
}
async function publish() {
  DECK.view = buildView(); await saveDeck();
  const r = await api("publish", { id: DECK.id });
  if (!r.token) return toast("Couldn't publish: " + (r.error || "error"));
  DECK.token = r.token; DECK.status = "published"; DIRTY = false; pubBox(); copyLink();
}
async function unpublish() { await api("unpublish", { id: DECK.id }); DECK.status = "draft"; pubBox(); toast("Link turned off"); }
function copyLink() { const u = deckUrl(); (navigator.share && /Mobi/.test(navigator.userAgent) ? navigator.share({ title: DECK.input.business + " search plan", url: u }) : navigator.clipboard.writeText(u)).then(() => toast("Link copied"), () => { }); }
async function exportPptx() { toast("Building the PowerPoint…"); try { DECK.view = buildView(); await DK.pptx(DECK.view); } catch (e) { console.error(e); toast("PowerPoint failed: " + e.message); } }
async function openDeck(id) {
  const d = await api("get", undefined, "kind=decks&id=" + encodeURIComponent(id));
  if (d.error) return toast("Couldn't open that deck");
  DECK = d; DECK.id = id; openEditor();
}
addEventListener("beforeunload", e => { if (DIRTY && $("#edit").classList.contains("on")) { e.preventDefault(); e.returnValue = ""; } });
boot();
