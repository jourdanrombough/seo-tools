/* Pitch deck renderer: builds the 12 slides from a deck "view", animates them in,
   and exports the same deck to PowerPoint (PptxGenJS). Used by the editor and the public viewer. */
const DK = (() => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = n => Math.round(n || 0).toLocaleString("en-US");
  const short = n => { n = n || 0; const a = Math.abs(n); if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M"; if (a >= 1e4) return Math.round(n / 1e3) + "K"; if (a >= 1e3) return (n / 1e3).toFixed(1) + "K"; return String(Math.round(n)); };
  const usd = n => "$" + Math.round(n || 0).toLocaleString("en-US");
  const pct = (x, d = 1) => x > 0 && x < .001 ? "<0.1%" : (100 * (x || 0)).toFixed(x < .1 ? d : 0) + "%";
  /* Two looks: "google" (white, Google's four colors) and "night" (the dark infographiac theme). */
  const THEMES = {
    google: {
      you: ["#34a853", "#5bb974"], lead: ["#ea4335", "#f28b82"], hero: ["#1a73e8", "#4285f4"], full: ["#fbbc05", "#f9ab00"],
      comps: ["#ea4335", "#fbbc05", "#4285f4", "#a142f4", "#24c1e0", "#9aa0a6"], rest: "#e8eaed",
      topics: ["#4285f4", "#ea4335", "#fbbc05", "#34a853", "#8ab4f8", "#f28b82"],
      months: ["#1a73e8", "#d93025", "#e37400", "#188038"], proof: ["#1a73e8", "#d93025", "#e37400", "#188038"],
      grid: "#e8eaed", axis: "#80868b", cons: "#bdc1c6", agg: "#8ab4f8", line: "#1a73e8", today: "#34a853", font: "Roboto",
      ppt: { bg: "FFFFFF", ink: "202124", muted: "5F6368", dim: "80868B", hero: "1A73E8", green: "188038", red: "D93025", pink: "E37400", panel: "F8F9FA", line: "DADCE0", grid: "E8EAED", cta: "1A73E8", ctaInk: "FFFFFF", cons: "BDC1C6", agg: "8AB4F8", you: "34A853", lead: "EA4335", full: "FBBC05",
        comps: ["EA4335", "FBBC05", "4285F4", "A142F4", "24C1E0", "9AA0A6"], months: ["1A73E8", "D93025", "E37400", "188038"], stripe: ["4285F4", "EA4335", "FBBC05", "34A853"], head: "Arial", body: "Arial" },
    },
    night: {
      you: ["#3ee98a", "#7ef5b0"], lead: ["#e0566a", "#ff8a96"], hero: ["#e0a21f", "#ffc13b"], full: ["#ff4fa8", "#c93b86"],
      comps: ["#ff5d6c", "#ff8a3d", "#ff4fa8", "#9b8cff", "#2fd0ff", "#7a7fae"], rest: "#2a2e58",
      topics: ["#ffc13b", "#ff8a3d", "#ff4fa8", "#9b8cff", "#2fd0ff", "#3ee98a"],
      months: ["#3ee98a", "#2fd0ff", "#9b8cff", "#ffc13b"], proof: ["#ffc13b", "#2fd0ff", "#3ee98a", "#ff4fa8"],
      grid: "#1d2044", axis: "#5d6296", cons: "#3b3f73", agg: "#5b4f9a", line: "#ffc13b", today: "#3ee98a", font: "Instrument Sans",
      ppt: { bg: "0A0B19", ink: "F3F4FF", muted: "B3B7E0", dim: "7A7FAE", hero: "FFC13B", green: "3EE98A", red: "FF5D6C", pink: "FF4FA8", panel: "141735", line: "2A2E58", grid: "1D2044", cta: "FFC13B", ctaInk: "16130A", cons: "3B3F73", agg: "5B4F9A", you: "3EE98A", lead: "FF5D6C", full: "FF4FA8",
        comps: ["FF5D6C", "FF8A3D", "FF4FA8", "9B8CFF", "2FD0FF", "7A7FAE"], months: ["3EE98A", "2FD0FF", "9B8CFF", "FFC13B"], stripe: null, head: "Arial Black", body: "Arial" },
    },
  };
  const themeOf = v => THEMES[v && v.theme] ? v.theme : "google";
  let T = THEMES.google;
  const grad = (a, ang = 90) => `linear-gradient(${ang}deg,${a[0]},${a[1]})`;
  const ORDER = ["cover", "opportunity", "today", "competitors", "gap", "ai", "health", "plan", "investment", "roi", "why", "next"];
  const LABEL = { cover: "Cover", opportunity: "The opportunity", today: "Where you stand", competitors: "Who's winning", gap: "The keyword gap", ai: "AI search", health: "Site health", plan: "The 90-day plan", investment: "The investment", roi: "What you get back", why: "Why us", next: "Next step" };

  function top(v, n, id) { return `<div class="sl-top"><span>${esc(v.prospect.business || v.prospect.domain)} · <b>${esc(LABEL[id])}</b></span><span>${String(n).padStart(2, "0")} / ${String(v.count).padStart(2, "0")}</span></div>`; }
  function words(s, id, edit) {
    const ce = edit ? ` contenteditable="true" spellcheck="true" data-s="${id}"` : "";
    return `<h2 class="rv"${ce} data-f="headline">${esc(s.headline)}</h2>${s.body ? `<p class="bd rv"${ce} data-f="body">${esc(s.body)}</p>` : (edit ? `<p class="bd rv"${ce} data-f="body"></p>` : "")}`;
  }
  function hbars(rows, max) {
    max = max || Math.max(1, ...rows.map(r => r.v));
    return `<div class="hb rv">${rows.map(r => { const w = Math.max(.8, 100 * r.v / max); return `<div class="hr"><div class="lb">${esc(r.l)}${r.s ? `<small>${esc(r.s)}</small>` : ""}</div><div class="tr"><i data-w="${w}" style="background:${r.c};--w:${w}%"></i></div><div class="vv" style="color:${r.tc || "var(--ink)"}">${r.t || fmt(r.v)}</div></div>`; }).join("")}</div>`;
  }
  function lineChart(series, opt = {}) {
    const W = 600, H = 300, m = { l: 48, r: 70, t: 14, b: 30 };
    const all = series.flatMap(s => s.d), max = Math.max(1, ...all) * 1.1;
    const x = i => m.l + (W - m.l - m.r) * i / 12, y = v => H - m.b - (H - m.t - m.b) * v / max;
    const path = d => d.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    const ticks = [0, .25, .5, .75, 1].map(f => max / 1.1 * f);
    const lab = opt.labels || [...Array(13)].map((_, i) => i === 0 ? "Now" : "M" + i);
    return `<div class="chart rv" style="flex:1;min-height:0"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="${T.grid}"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end" fill="${T.axis}" font-size="11" font-family="JetBrains Mono">${short(t)}</text>`).join("")}
      ${[0, 3, 6, 9, 12].map(i => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" fill="${T.axis}" font-size="11" font-family="JetBrains Mono">${esc(lab[i])}</text>`).join("")}
      ${series.map(s => `<path class="ln" d="${path(s.d)}" fill="none" stroke="${s.c}" stroke-width="${s.w || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} stroke-linecap="round"/>`).join("")}
      ${series.filter(s => s.end).map(s => `<circle cx="${x(12)}" cy="${y(s.d[12])}" r="5" fill="${s.c}"/><text x="${x(12) + 9}" y="${y(s.d[12]) + 4}" fill="${s.c}" font-size="13" font-weight="800" font-family="${T.font}">${short(s.d[12])}</text>`).join("")}
    </svg></div>`;
  }

  const S = {
    cover(v, s, n, edit) {
      const a = v.agency;
      return `<div class="sl-in cover"><div class="brand rv">${a.logo ? `<img src="${esc(a.logo)}" alt="">` : "<i></i>"}${esc(a.name)}</div>
        <div><div class="sl-top rv" style="margin-bottom:1.4cqw"><span>Search growth plan · ${esc(new Date(v.date).toLocaleDateString("en-US", { month: "long", year: "numeric" }))}</span></div>
        <h1 class="rv"${edit ? ` contenteditable="true" data-s="cover" data-f="headline"` : ""}>${esc(s.headline)}</h1>
        <p class="bd rv" style="margin-top:1.6cqw"${edit ? ` contenteditable="true" data-s="cover" data-f="body"` : ""}>${esc(s.body)}</p></div>
        <div class="who rv">Prepared for ${esc(v.prospect.contact ? v.prospect.contact + ", " : "")}${esc(v.prospect.business || v.prospect.domain)} · by ${esc(a.person)}, ${esc(a.title)}</div>
        <div class="orb" style="width:40%;height:60%;right:-8%;top:-10%;background:var(--gold);opacity:.18"></div></div>`;
    },
    opportunity(v, s, n, edit) {
      const d = v.data;
      return `<div class="sl-in">${top(v, n, "opportunity")}${words(s, "opportunity", edit)}<div class="grow"><div class="col"><div class="big rv" data-count="${d.missing}">0</div><div class="bigl rv">visits a month going to competitors</div></div>
        <div class="col"><div class="stats rv" style="--n:2"><div class="stat" style="--c:var(--green)"><b>${fmt(d.today.visits)}</b><span>visits a month you get today</span></div><div class="stat" style="--c:var(--gold)"><b>+${fmt(d.gain12)}</b><span>realistic gain within 12 months</span></div><div class="stat"><b>${fmt(d.market.searches)}</b><span>searches in your market</span></div><div class="stat" style="--c:var(--pink)"><b>${pct(d.today.share)}</b><span>of the clicks you capture now</span></div></div></div></div></div>`;
    },
    today(v, s, n, edit) {
      const d = v.data, rows = [
        { l: "You today", s: v.prospect.domain, v: d.today.visits, c: grad(T.you) },
        d.leader && { l: "The market leader", s: d.leader.d, v: d.leader.visits, c: grad(T.lead) },
        { l: "You in 12 months", s: "expected plan", v: d.today.visits + d.gain12, c: grad(T.hero), tc: "var(--gold)" },
        { l: "Top 3 everywhere", s: "full potential", v: d.today.visits + d.full, c: `repeating-linear-gradient(135deg,${T.full[0]} 0 8px,${T.full[1]} 8px 16px)` },
      ].filter(Boolean);
      return `<div class="sl-in">${top(v, n, "today")}${words(s, "today", edit)}<div class="grow"><div class="col" style="flex:1.5">${hbars(rows)}</div>
        <div class="col"><div class="stats rv" style="--n:1"><div class="stat"><b>${fmt(d.today.kw10)}</b><span>searches where you're on page one</span></div><div class="stat" style="--c:var(--gold)"><b>${fmt(d.striking)}</b><span>searches ranked 4 to 20, one push from the top 3</span></div></div></div></div></div>`;
    },
    competitors(v, s, n, edit) {
      const d = v.data, cs = d.comps.slice(0, 5), you = d.today.share, rest = Math.max(0, 1 - you - cs.reduce((a, c) => a + c.share, 0));
      const segs = [{ l: "You", v: you, c: T.you[0] }, ...cs.map((c, j) => ({ l: c.d, v: c.share, c: T.comps[j] })), { l: "Everyone else", v: rest, c: T.rest }];
      return `<div class="sl-in">${top(v, n, "competitors")}${words(s, "competitors", edit)}
        <div class="share rv">${segs.map(g => `<i data-w="${100 * g.v}" style="background:${g.c};--w:${100 * g.v}%"></i>`).join("")}</div>
        <div class="lg rv">${segs.map(g => `<span><i style="background:${g.c}"></i>${esc(g.l)} ${pct(g.v)}</span>`).join("")}</div>
        <div class="grow" style="margin-top:2cqw"><div class="col" style="justify-content:flex-start">${hbars(cs.map((c, j) => ({ l: c.d, s: c.type ? c.type + (c.kw10 ? " · " + c.kw10 + " page-one searches" : "") : "", v: c.visits, c: T.comps[j] })).concat([{ l: v.prospect.domain, s: "you", v: d.today.visits, c: T.you[0], tc: "var(--green)" }]))}</div></div></div>`;
    },
    gap(v, s, n, edit) {
      const t = v.data.topics.slice(0, 6), max = Math.max(1, ...t.map(x => x.pot));
      return `<div class="sl-in">${top(v, n, "gap")}${words(s, "gap", edit)}<div class="grow"><div class="col" style="flex:1.6;justify-content:flex-start">${hbars(t.map((x, j) => ({ l: x.name, s: `${x.n} searches${x.lead ? " · led by " + x.lead : ""}`, v: x.pot, t: "+" + fmt(x.pot), c: T.topics[j], tc: "var(--gold)" })), max)}</div>
        <div class="col"><div class="stats rv" style="--n:1"><div class="stat" style="--c:var(--gold)"><b>${fmt(v.data.notYours.n)}</b><span>searches where you're not on page one yet</span></div><div class="stat"><b>${fmt(v.data.notYours.visits)}</b><span>visits a month those searches send to others</span></div></div></div></div></div>`;
    },
    ai(v, s, n, edit) {
      const a = v.data.ai || { answers: [] };
      const gpt = a.answers.filter(x => x.engine !== "Google AI Overview"), aio = a.answers.filter(x => x.engine === "Google AI Overview");
      const rows = [...gpt.slice(0, aio.length ? 4 : 5), ...aio.slice(0, 1)].map(x => `<tr><td>${esc(x.q)}<div style="color:var(--dim);font-size:.85em;margin-top:.3em">${esc(x.engine)}${x.top && x.top.length ? " · cites " + esc(x.top.slice(0, 3).join(", ")) : ""}</div></td><td class="n"><span class="tag ${x.mentioned || x.cited ? "yes" : "no"}">${x.cited ? "cited" : x.mentioned ? "mentioned" : "not there"}</span></td></tr>`).join("");
      return `<div class="sl-in">${top(v, n, "ai")}${words(s, "ai", edit)}<div class="grow"><div class="col" style="flex:1.8;justify-content:flex-start"><table class="tbl rv"><tr><th>What buyers ask AI</th><th style="text-align:right">You</th></tr>${rows || `<tr><td colspan="2" style="color:var(--dim)">No AI answers were checked for this deck.</td></tr>`}</table></div>
        <div class="col"><div class="stats rv" style="--n:1"><div class="stat" style="--c:${a.seen ? "var(--gold)" : "var(--red)"}"><b>${a.seen || 0} of ${a.checked || 0}</b><span>AI answers that mention or cite you</span></div>${a.aio != null ? `<div class="stat"><b>${a.aio} of ${a.aioChecked || 0}</b><span>Google results showing an AI Overview${a.aioYou ? ", " + a.aioYou + " citing you" : ""}</span></div>` : ""}</div></div></div></div>`;
    },
    health(v, s, n, edit) {
      const h = v.data.health; if (!h) return "";
      const sev = { high: "no", medium: "mid", low: "yes" };
      return `<div class="sl-in">${top(v, n, "health")}${words(s, "health", edit)}<div class="grow"><div class="col" style="flex:.7"><div class="big rv" style="color:${h.score >= 80 ? "var(--green)" : h.score >= 60 ? "var(--gold)" : "var(--red)"}" data-count="${h.score}">0</div><div class="bigl rv">health score out of 100 · ${fmt(h.pages)} URLs crawled</div></div>
        <div class="col" style="flex:1.6;justify-content:flex-start"><table class="tbl rv"><tr><th>Issue</th><th style="text-align:right">Pages</th></tr>${h.issues.slice(0, 6).map(i => `<tr><td><span class="tag ${sev[i.sev]}">${esc(i.sev)}</span> ${esc(i.label)}<div style="color:var(--dim);font-size:.85em;margin-top:.3em">${esc(i.why)}</div></td><td class="n">${fmt(i.count)}</td></tr>`).join("")}</table></div></div></div>`;
    },
    plan(v, s, n, edit) {
      const ms = v.data.plan.months.filter(m => m.items.length), cs = T.months;
      return `<div class="sl-in">${top(v, n, "plan")}${words(s, "plan", edit)}<div class="months rv" style="--n:${ms.length}">${ms.map(m => `<div class="mo" style="--c:${cs[(m.m - 1) % 4]}"><h4>${esc(m.title)}</h4><ul>${m.items.slice(0, 6).map(i => `<li><b>${esc(i.name)}</b>${i.why ? `<span>${esc(i.why)}</span>` : ""}</li>`).join("")}${m.items.length > 6 ? `<li><span>+ ${m.items.length - 6} more</span></li>` : ""}</ul></div>`).join("")}</div></div>`;
    },
    investment(v, s, n, edit) {
      const p = v.data.pricing, t = p.tier;
      const cards = [];
      if (p.oneTime > 0) cards.push(`<div class="pcard ${!t ? "hl" : ""}"><h4>One-time foundation</h4><div class="price">${usd(p.oneTime)}</div><div style="color:var(--dim);font-size:1.2cqw">${p.lines.filter(l => !l.monthly).length} line items, first 90 days</div></div>`);
      if (t) cards.push(`<div class="pcard hl"><h4>Monthly · ${esc(t.name)}</h4><div class="price">${usd(t.price)}<small>/month</small></div><ul>${t.includes.slice(0, 5).map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`);
      const lines = p.lines.filter(l => !l.monthly).slice(0, 9);
      return `<div class="sl-in">${top(v, n, "investment")}${words(s, "investment", edit)}<div class="grow"><div class="col" style="flex:1;justify-content:flex-start;gap:1.4cqw" >${cards.join("")}</div>
        <div class="col" style="flex:1.5;justify-content:flex-start"><table class="tbl rv"><tr><th>What's included</th><th style="text-align:right">Price</th></tr>${lines.map(l => `<tr><td>${esc(l.name)}${l.qty > 1 ? ` <span style="color:var(--dim)">× ${l.qty}</span>` : ""}</td><td class="n">${usd(l.price)}</td></tr>`).join("")}${p.lines.filter(l => !l.monthly).length > 9 ? `<tr><td style="color:var(--dim)">+ ${p.lines.filter(l => !l.monthly).length - 9} more items</td><td></td></tr>` : ""}${p.note ? `<tr><td colspan="2" style="color:var(--dim)">${esc(p.note)}</td></tr>` : ""}</table></div></div></div>`;
    },
    roi(v, s, n, edit) {
      const d = v.data, r = d.roi, mo = d.months;
      const st = [`<div class="stat" style="--c:var(--gold)"><b>+${fmt(d.gain12)}</b><span>more visits a month by month 12</span></div>`];
      if (r.leadRate) st.push(`<div class="stat" style="--c:var(--green)"><b>+${fmt(r.leads)}</b><span>more leads a month at a ${pct(r.leadRate)} visit-to-lead rate</span></div>`);
      if (r.leadValue) st.push(`<div class="stat" style="--c:var(--pink)"><b>${usd(r.value)}</b><span>a month in lead value${r.payback ? ` · pays back in about ${r.payback} months` : ""}</span></div>`);
      return `<div class="sl-in">${top(v, n, "roi")}${words(s, "roi", edit)}<div class="grow"><div class="col" style="flex:1.6">${lineChart([{ d: d.monthsCons, c: T.cons, dash: "4 4", w: 1.5 }, { d: d.monthsAgg, c: T.agg, dash: "4 4", w: 1.5 }, { d: mo, c: T.line, w: 3.5, end: true }, { d: mo.map(() => d.today.visits), c: T.today, dash: "2 4", w: 1.5 }], { labels: d.monthLabels })}</div>
        <div class="col"><div class="stats rv" style="--n:1">${st.join("")}</div></div></div></div>`;
    },
    why(v, s, n, edit) {
      const a = v.agency;
      return `<div class="sl-in">${top(v, n, "why")}${words(s, "why", edit)}<div class="grow"><div class="col" style="flex:1.2;justify-content:flex-start"><p class="rv" style="font-size:1.6cqw;line-height:1.55;color:var(--muted);margin:0">${esc(a.bio)}</p></div>
        <div class="col" style="justify-content:flex-start"><div class="stats rv" style="--n:1">${(a.proof || []).slice(0, 4).map((p, j) => `<div class="stat" style="--c:${T.proof[j]};border-left:.5cqw solid ${T.proof[j]}"><span style="font-size:1.45cqw;color:var(--ink);margin:0">${esc(p)}</span></div>`).join("")}</div></div></div></div>`;
    },
    next(v, s, n, edit) {
      const a = v.agency;
      return `<div class="sl-in cover">${top(v, n, "next")}<div>${words(s, "next", edit)}<a class="cta rv" href="${esc(a.booking)}" target="_blank" rel="noopener">${esc(a.bookingLabel || "Book a call")} ▸</a></div>
        <div class="who rv">${esc(a.person)} · ${esc(a.email)}${a.phone ? " · " + esc(a.phone) : ""} · ${esc(a.site)}</div>
        <div class="orb" style="width:45%;height:70%;right:-10%;bottom:-20%;background:var(--pink);opacity:.18"></div></div>`;
    },
  };

  function slidesOf(v) { return ORDER.filter(id => v.slides[id] && (id !== "health" || v.data.health)); }

  function render(v, el, opt = {}) {
    const ids = slidesOf(v).filter(id => opt.edit || v.slides[id].on !== false);
    v.count = ids.length;
    const tn = themeOf(v); T = THEMES[tn];
    el.classList.remove(...Object.keys(THEMES).map(k => "t-" + k));
    el.classList.add("deck", "t-" + tn);
    el.innerHTML = ids.map((id, i) => `<section class="sl${v.slides[id].on === false ? " off" : ""}${opt.static ? " static in" : ""}" data-id="${id}">${S[id](v, v.slides[id], i + 1, opt.edit)}${opt.edit ? `<label class="sl-tog"><input type="checkbox" ${v.slides[id].on === false ? "" : "checked"} data-tog="${id}"> show</label>` : ""}</section>`).join("");
    const go = sec => {
      if (sec.dataset.done) return; sec.dataset.done = 1; sec.classList.add("in");
      sec.querySelectorAll("[data-w]").forEach((i, j) => opt.static ? i.style.width = i.dataset.w + "%" : setTimeout(() => i.style.width = i.dataset.w + "%", 250 + j * 120));
      sec.querySelectorAll("[data-count]").forEach(e => { const to = +e.dataset.count; if (opt.static) { e.textContent = fmt(to); return; } const t0 = performance.now(); (function f() { const p = Math.min(1, (performance.now() - t0) / 1500), k = 1 - Math.pow(1 - p, 3); e.textContent = fmt(to * k); if (p < 1) requestAnimationFrame(f); })(); });
      sec.querySelectorAll("path.ln").forEach(p => { try { const L = p.getTotalLength(); p.style.strokeDasharray = p.getAttribute("stroke-dasharray") || L; if (!p.getAttribute("stroke-dasharray")) { p.style.strokeDashoffset = L; p.getBoundingClientRect(); p.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)"; p.style.strokeDashoffset = 0; } } catch (e) { } });
    };
    if (opt.static || !("IntersectionObserver" in window)) el.querySelectorAll(".sl").forEach(go);
    else { const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { go(e.target); io.unobserve(e.target); } }), { threshold: .25 }); el.querySelectorAll(".sl").forEach(s => io.observe(s)); }
    addEventListener("beforeprint", () => el.querySelectorAll(".sl").forEach(go));
  }

  /* ---------- PowerPoint export ---------- */
  async function loadPptx() {
    if (window.PptxGenJS) return;
    await new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"; s.onload = ok; s.onerror = () => bad(new Error("Couldn't load the PowerPoint library")); document.head.appendChild(s); });
  }
  async function pptx(v) {
    await loadPptx();
    const P = new PptxGenJS(); P.layout = "LAYOUT_WIDE"; P.title = `${v.prospect.business || v.prospect.domain} search growth plan`; P.author = v.agency.person; P.company = v.agency.name;
    const Q = THEMES[themeOf(v)].ppt;
    const BG = Q.bg, INK = Q.ink, MUTED = Q.muted, DIM = Q.dim, GOLD = Q.hero, GREEN = Q.green, RED = Q.red, PINK = Q.pink, PANEL = Q.panel, LINE = Q.line, GRID = Q.grid;
    const HF = Q.head, BF = Q.body;
    const stripe = sl => { if (Q.stripe) Q.stripe.forEach((c, j) => sl.addShape(P.ShapeType.rect, { x: j * 13.333 / 4, y: 0, w: 13.333 / 4, h: .08, fill: { color: c }, line: { color: c } })); };
    const ids = slidesOf(v).filter(id => v.slides[id].on !== false), N = ids.length;
    const head = (sl, id, i) => {
      sl.background = { color: BG }; stripe(sl);
      sl.addText(`${(v.prospect.business || v.prospect.domain).toUpperCase()} · ${LABEL[id].toUpperCase()}`, { x: .6, y: .3, w: 9, h: .3, fontFace: BF, fontSize: 10, color: DIM, charSpacing: 2 });
      sl.addText(`${String(i + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`, { x: 11.2, y: .3, w: 1.5, h: .3, fontFace: BF, fontSize: 10, color: DIM, align: "right" });
      const s = v.slides[id];
      sl.addText(s.headline || "", { x: .6, y: .7, w: 11.6, h: .9, fontFace: HF, fontSize: 28, color: INK, bold: true, valign: "top", fit: "shrink" });
      if (s.body) sl.addText(s.body, { x: .6, y: 1.6, w: 9.5, h: .8, fontFace: BF, fontSize: 14, color: MUTED, valign: "top" });
    };
    const stat = (sl, x, y, w, big, label, color) => {
      sl.addShape(P.ShapeType.roundRect, { x, y, w, h: 1.15, fill: { color: PANEL }, line: { color: LINE }, rectRadius: .12 });
      sl.addText(big, { x: x + .2, y: y + .1, w: w - .4, h: .55, fontFace: HF, fontSize: 22, color: color || INK, bold: true });
      sl.addText(label, { x: x + .2, y: y + .62, w: w - .4, h: .45, fontFace: BF, fontSize: 11, color: DIM, valign: "top" });
    };
    const barOpts = (colors) => ({ barDir: "bar", chartColors: colors, catAxisLabelColor: MUTED, valAxisLabelColor: DIM, catAxisLabelFontSize: 11, valAxisLabelFontSize: 9, valGridLine: { color: GRID, size: .5 }, catGridLine: { style: "none" }, showValue: true, dataLabelColor: INK, dataLabelFontSize: 10, dataLabelFormatCode: "#,##0", valAxisLabelFormatCode: "#,##0", catAxisOrientation: "maxMin" });
    const d = v.data;
    ids.forEach((id, i) => {
      const sl = P.addSlide(), s = v.slides[id];
      if (id === "cover") {
        sl.background = { color: BG }; stripe(sl);
        sl.addText(v.agency.name, { x: .6, y: .5, w: 8, h: .4, fontFace: HF, fontSize: 14, color: INK, bold: true });
        sl.addText(s.headline, { x: .6, y: 2.1, w: 11, h: 2, fontFace: HF, fontSize: 40, color: INK, bold: true, valign: "top", fit: "shrink" });
        if (s.body) sl.addText(s.body, { x: .6, y: 4.2, w: 10, h: 1, fontFace: BF, fontSize: 16, color: MUTED, valign: "top" });
        sl.addText(`Prepared for ${v.prospect.contact ? v.prospect.contact + ", " : ""}${v.prospect.business || v.prospect.domain} · by ${v.agency.person}`, { x: .6, y: 6.6, w: 11, h: .4, fontFace: BF, fontSize: 12, color: DIM });
        return;
      }
      head(sl, id, i);
      if (id === "opportunity") {
        sl.addText(fmt(d.missing), { x: .6, y: 2.7, w: 6, h: 1.6, fontFace: HF, fontSize: 72, color: GOLD, bold: true });
        sl.addText("VISITS A MONTH GOING TO COMPETITORS", { x: .6, y: 4.3, w: 6, h: .4, fontFace: BF, fontSize: 12, color: MUTED, charSpacing: 1 });
        stat(sl, 7.2, 2.7, 2.6, fmt(d.today.visits), "visits a month today", GREEN); stat(sl, 10, 2.7, 2.6, "+" + fmt(d.gain12), "realistic 12-month gain", GOLD);
        stat(sl, 7.2, 4.05, 2.6, fmt(d.market.searches), "searches in your market"); stat(sl, 10, 4.05, 2.6, pct(d.today.share), "of clicks you capture", PINK);
      } else if (id === "today") {
        const rows = [["You today", d.today.visits], d.leader && ["Leader: " + d.leader.d, d.leader.visits], ["You in 12 months", d.today.visits + d.gain12], ["Top 3 everywhere", d.today.visits + d.full]].filter(Boolean);
        sl.addChart(P.ChartType.bar, [{ name: "Visits / month", labels: rows.map(r => r[0]), values: rows.map(r => Math.round(r[1])) }], { x: .6, y: 2.5, w: 8, h: 4.4, ...barOpts([Q.you, Q.lead, Q.hero, Q.full].slice(0, rows.length)), varyColors: true });
        stat(sl, 9.2, 2.7, 3.5, fmt(d.today.kw10), "searches where you're on page one"); stat(sl, 9.2, 4.05, 3.5, fmt(d.striking), "searches ranked 4 to 20", GOLD);
      } else if (id === "competitors") {
        const cs = d.comps.slice(0, 5);
        sl.addChart(P.ChartType.doughnut, [{ name: "Share of clicks", labels: ["You", ...cs.map(c => c.d), "Everyone else"], values: [d.today.share, ...cs.map(c => c.share), Math.max(0, 1 - d.today.share - cs.reduce((a, c) => a + c.share, 0))].map(x => +(x * 100).toFixed(1)) }],
          { x: .5, y: 2.4, w: 5.2, h: 4.6, holeSize: 58, chartColors: [Q.you, ...Q.comps.slice(0, 5), Q.line], showLegend: true, legendPos: "r", legendColor: MUTED, legendFontSize: 10, dataLabelColor: INK, showPercent: false, showValue: false });
        sl.addChart(P.ChartType.bar, [{ name: "Visits / month", labels: [...cs.map(c => c.d), v.prospect.domain], values: [...cs.map(c => Math.round(c.visits)), Math.round(d.today.visits)] }], { x: 6.2, y: 2.4, w: 6.5, h: 4.6, ...barOpts([...Q.comps.slice(0, 5), Q.you]), varyColors: true });
      } else if (id === "gap") {
        const t = d.topics.slice(0, 6);
        sl.addChart(P.ChartType.bar, [{ name: "Visits a month open", labels: t.map(x => x.name), values: t.map(x => Math.round(x.pot)) }], { x: .6, y: 2.5, w: 8.2, h: 4.5, ...barOpts([GOLD]) });
        stat(sl, 9.2, 2.7, 3.5, fmt(d.notYours.n), "searches where you're not on page one", GOLD); stat(sl, 9.2, 4.05, 3.5, fmt(d.notYours.visits), "visits a month they send to others");
      } else if (id === "ai") {
        const a = d.ai || { answers: [] };
        const rows = [[{ text: "What buyers ask AI", options: { bold: true, color: DIM, fontSize: 10 } }, { text: "You", options: { bold: true, color: DIM, fontSize: 10, align: "right" } }],
          ...a.answers.slice(0, 6).map(x => [{ text: `${x.q}  (${x.engine})`, options: { color: INK, fontSize: 11 } }, { text: x.cited ? "cited" : x.mentioned ? "mentioned" : "not there", options: { color: x.cited || x.mentioned ? GREEN : RED, fontSize: 11, align: "right", bold: true } }])];
        sl.addTable(rows, { x: .6, y: 2.5, w: 8.4, colW: [6.9, 1.5], border: { type: "solid", color: GRID, pt: .5 }, fill: { color: BG }, fontFace: BF });
        stat(sl, 9.4, 2.6, 3.3, `${a.seen || 0} of ${a.checked || 0}`, "AI answers that mention or cite you", a.seen ? GOLD : RED);
        if (a.aio != null) stat(sl, 9.4, 3.95, 3.3, `${a.aio} of ${a.aioChecked || 0}`, "results with an AI Overview");
      } else if (id === "health") {
        const h = d.health;
        sl.addText(String(h.score), { x: .6, y: 2.6, w: 3.4, h: 1.5, fontFace: HF, fontSize: 66, color: h.score >= 80 ? GREEN : h.score >= 60 ? GOLD : RED, bold: true });
        sl.addText(`HEALTH SCORE / 100 · ${fmt(h.pages)} URLS`, { x: .6, y: 4.1, w: 3.6, h: .4, fontFace: BF, fontSize: 11, color: MUTED });
        sl.addTable([[{ text: "Issue", options: { bold: true, color: DIM, fontSize: 10 } }, { text: "Pages", options: { bold: true, color: DIM, fontSize: 10, align: "right" } }], ...h.issues.slice(0, 7).map(x => [{ text: `${x.label}`, options: { color: INK, fontSize: 11 } }, { text: fmt(x.count), options: { color: x.sev === "high" ? RED : x.sev === "medium" ? GOLD : GREEN, fontSize: 11, align: "right", bold: true } }])],
          { x: 4.6, y: 2.5, w: 8.1, colW: [6.9, 1.2], border: { type: "solid", color: GRID, pt: .5 }, fill: { color: BG }, fontFace: BF });
      } else if (id === "plan") {
        const ms = d.plan.months.filter(m => m.items.length), w = (12.1 - (ms.length - 1) * .25) / ms.length, cs = Q.months;
        ms.forEach((m, j) => {
          const x = .6 + j * (w + .25);
          sl.addShape(P.ShapeType.roundRect, { x, y: 2.45, w, h: 4.6, fill: { color: PANEL }, line: { color: LINE }, rectRadius: .12 });
          sl.addText(m.title.toUpperCase(), { x: x + .2, y: 2.6, w: w - .4, h: .35, fontFace: BF, fontSize: 11, color: cs[(m.m - 1) % 4], bold: true, charSpacing: 1 });
          sl.addText(m.items.slice(0, 7).map(it => ({ text: it.name, options: { bullet: { code: "25B8" }, color: INK, fontSize: 11, paraSpaceAfter: 6 } })), { x: x + .15, y: 3.0, w: w - .3, h: 3.9, fontFace: BF, valign: "top" });
        });
      } else if (id === "investment") {
        const p = d.pricing; let y = 2.5;
        if (p.oneTime > 0) { stat(sl, .6, y, 4.4, usd(p.oneTime), "one-time foundation, first 90 days", GOLD); y += 1.35; }
        if (p.tier) { stat(sl, .6, y, 4.4, usd(p.tier.price) + "/mo", "monthly · " + p.tier.name, GOLD); sl.addText(p.tier.includes.slice(0, 5).map(t => ({ text: t, options: { bullet: true, color: MUTED, fontSize: 11 } })), { x: .6, y: y + 1.25, w: 4.4, h: 1.8, fontFace: BF, valign: "top" }); }
        const lines = p.lines.filter(l => !l.monthly).slice(0, 10);
        if (lines.length) sl.addTable([[{ text: "What's included", options: { bold: true, color: DIM, fontSize: 10 } }, { text: "Price", options: { bold: true, color: DIM, fontSize: 10, align: "right" } }], ...lines.map(l => [{ text: l.name + (l.qty > 1 ? ` × ${l.qty}` : ""), options: { color: INK, fontSize: 11 } }, { text: usd(l.price), options: { color: INK, fontSize: 11, align: "right" } }])],
          { x: 5.5, y: 2.5, w: 7.2, colW: [5.8, 1.4], border: { type: "solid", color: GRID, pt: .5 }, fill: { color: BG }, fontFace: BF });
      } else if (id === "roi") {
        const lab = d.monthLabels;
        sl.addChart(P.ChartType.line, [{ name: "Expected", labels: lab, values: d.months }, { name: "Conservative", labels: lab, values: d.monthsCons }, { name: "Aggressive", labels: lab, values: d.monthsAgg }],
          { x: .6, y: 2.5, w: 8.2, h: 4.5, chartColors: [GOLD, Q.cons, Q.agg], lineSize: 3, lineDataSymbol: "none", catAxisLabelColor: DIM, valAxisLabelColor: DIM, valGridLine: { color: GRID, size: .5 }, catGridLine: { style: "none" }, showLegend: true, legendPos: "b", legendColor: MUTED, valAxisLabelFormatCode: "#,##0" });
        let y = 2.6; stat(sl, 9.2, y, 3.5, "+" + fmt(d.gain12), "more visits a month by month 12", GOLD); y += 1.35;
        if (d.roi.leadRate) { stat(sl, 9.2, y, 3.5, "+" + fmt(d.roi.leads), `more leads a month at ${pct(d.roi.leadRate)}`, GREEN); y += 1.35; }
        if (d.roi.leadValue) stat(sl, 9.2, y, 3.5, usd(d.roi.value), "a month in lead value" + (d.roi.payback ? `, payback ~${d.roi.payback} mo` : ""), PINK);
      } else if (id === "why") {
        sl.addText(v.agency.bio, { x: .6, y: 2.5, w: 6.4, h: 3, fontFace: BF, fontSize: 15, color: MUTED, valign: "top" });
        (v.agency.proof || []).slice(0, 4).forEach((p, j) => { sl.addShape(P.ShapeType.roundRect, { x: 7.5, y: 2.5 + j * 1.05, w: 5.2, h: .85, fill: { color: PANEL }, line: { color: LINE }, rectRadius: .1 }); sl.addText(p, { x: 7.7, y: 2.5 + j * 1.05, w: 4.9, h: .85, fontFace: BF, fontSize: 13, color: INK, valign: "middle" }); });
      } else if (id === "next") {
        sl.addShape(P.ShapeType.roundRect, { x: .6, y: 3.2, w: 3.6, h: .8, fill: { color: Q.cta }, rectRadius: .4, hyperlink: { url: v.agency.booking } });
        sl.addText((v.agency.bookingLabel || "Book a call") + " ▸", { x: .6, y: 3.2, w: 3.6, h: .8, fontFace: HF, fontSize: 16, color: Q.ctaInk, bold: true, align: "center", valign: "middle", hyperlink: { url: v.agency.booking } });
        sl.addText(`${v.agency.person} · ${v.agency.email}${v.agency.phone ? " · " + v.agency.phone : ""} · ${v.agency.site}`, { x: .6, y: 6.6, w: 12, h: .4, fontFace: BF, fontSize: 12, color: DIM });
      }
    });
    const name = `${(v.prospect.domain || "deck").replace(/[^a-z0-9]+/gi, "-")}-seo-plan.pptx`;
    await P.writeFile({ fileName: name });
    return name;
  }

  return { render, pptx, ORDER, LABEL, slidesOf, fmt, usd, short, pct, esc, THEMES, themeOf };
})();
