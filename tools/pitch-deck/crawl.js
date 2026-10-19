/* Crawl export reader (runs in the browser; the file never leaves your device).
   Screaming Frog: internal_all.csv (or internal_html.csv), plain or zipped.
   Sitebulb: the "All exports" zip (reads *_internal.csv). */
const CRAWL_ISSUES = {
  missing_title: ["On-page", "high", "Pages with no title tag", "Google has nothing to show as the clickable headline."],
  missing_meta: ["On-page", "medium", "Pages with no meta description", "Google writes its own snippet, usually a worse one."],
  missing_h1: ["On-page", "medium", "Pages with no H1 heading", "Search engines and AI can't tell what the page is about at a glance."],
  dup_title: ["On-page", "medium", "Duplicate page titles", "Pages compete with each other for the same searches."],
  thin: ["Content", "high", "Thin pages with very little text", "Too little substance to rank or to be quoted by AI answers."],
  noindex: ["Indexing", "medium", "Pages blocked from Google (noindex)", "Make sure none of these should be earning traffic."],
  canonicalized: ["Indexing", "medium", "Duplicate URL versions (canonicalized)", "Copies of the same page split the signals."],
  redirects: ["Indexing", "low", "Internal links pointing at redirects", "Wastes crawl budget and slows every click."],
  errors: ["Indexing", "high", "Broken pages (4xx/5xx)", "Dead ends for visitors and for Google."],
  deep: ["Architecture", "medium", "Pages buried 4+ clicks deep", "Deep pages get crawled less and rank worse."],
  slow: ["Performance", "medium", "Slow server response (over 1 second)", "Slow first byte hurts Core Web Vitals and conversions."],
  dup_content: ["Content", "medium", "Duplicate or near-duplicate pages", "Google picks one version and ignores the rest."],
  broken_links: ["Indexing", "high", "Broken links on the site", "Every broken link wastes a visitor and leaks authority."],
  missing_alt: ["Accessibility", "low", "Pages with images missing alt text", "Lost image-search traffic and an accessibility gap."],
  title_long: ["On-page", "low", "Titles too long for Google to show", "The end of the title gets cut off in search results."],
  orphan: ["Architecture", "medium", "Orphan pages (no internal links in)", "Google and visitors struggle to find pages nothing links to."],
  mixed: ["Security", "low", "HTTPS pages linking to HTTP", "Mixed links look insecure and add redirects."],
  render_blocking: ["Performance", "low", "Render-blocking scripts and styles", "The page paints later, which hurts Core Web Vitals."],
  no_sitemap: ["Indexing", "medium", "No XML sitemap found", "Google finds new pages slower without one."],
  no_robots: ["Indexing", "low", "No robots.txt file", "Crawlers get no guidance on what to skip."],
  no_https: ["Security", "high", "HTTPS isn't enforced", "Browsers warn visitors and Google prefers secure pages."],
};
function crawlScore(list, indexable) {
  const n = Math.max(1, indexable), w = { high: 9, medium: 5, low: 2 };
  return Math.max(18, Math.min(98, Math.round(100 - list.reduce((a, i) => a + w[i.sev] * (0.35 + 0.65 * Math.min(1, i.count / n)), 0))));
}
/* DataForSEO On-Page crawl: turn on_page/summary into the same shape as an uploaded export */
function crawlFromSummary(r, maxPages) {
  const pm = r.page_metrics || {}, ch = pm.checks || {}, di = (r.domain_info || {}).checks || {}, cs = r.crawl_status || {};
  const pages = cs.pages_crawled || 0, issues = [];
  const add = (k, n) => { n = Math.round(+n || 0); if (n > 0) { const [cat, sev, label, why] = CRAWL_ISSUES[k]; issues.push({ key: k, cat, sev, label, why, count: n, examples: [] }); } };
  add("missing_title", ch.no_title); add("missing_meta", ch.no_description); add("missing_h1", ch.no_h1_tag);
  add("dup_title", Math.max(pm.duplicate_title || 0, ch.duplicate_title_tag || 0)); add("dup_content", pm.duplicate_content);
  add("thin", ch.low_character_count); add("noindex", pm.non_indexable);
  add("redirects", Math.max(ch.has_links_to_redirects || 0, ch.redirect_chain || 0));
  add("errors", (ch.is_4xx_code || 0) + (ch.is_5xx_code || 0)); add("broken_links", pm.broken_links);
  add("slow", Math.max(ch.high_loading_time || 0, ch.high_waiting_time || 0)); add("missing_alt", ch.no_image_alt);
  add("title_long", ch.title_too_long); add("orphan", ch.is_orphan_page); add("mixed", ch.https_to_http_links);
  add("render_blocking", ch.has_render_blocking_resources);
  if (di.sitemap === false) add("no_sitemap", 1); if (di.robots_txt === false) add("no_robots", 1);
  if (di.ssl === false || di.test_https_redirect === false) add("no_https", 1);
  const order = { high: 0, medium: 1, low: 2 }; issues.sort((a, b) => order[a.sev] - order[b.sev] || b.count - a.count);
  const indexable = Math.max(0, pages - (pm.non_indexable || 0));
  return { source: "DataForSEO crawl", file: null, pages, html: pages, indexable, score: crawlScore(issues, indexable), dfsScore: pm.onpage_score ?? null,
    partial: r.crawl_progress !== "finished", queued: cs.pages_in_queue || 0, max: maxPages, issues };
}

function parseCSV(text) {
  const rows = []; let row = [], cur = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim());
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
const cnum = v => { const n = parseFloat(String(v || "").replace(/,/g, "")); return isFinite(n) ? n : 0; };

async function readCrawlFile(file) {
  let files = {};
  if (/\.zip$/i.test(file.name)) {
    if (!window.JSZip) await new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    const z = await JSZip.loadAsync(file);
    const names = Object.keys(z.files).filter(n => /\.csv$/i.test(n) && (/_internal\.csv$/i.test(n) || /internal_(all|html)\.csv$/i.test(n)));
    for (const n of names) files[n] = await z.files[n].async("string");
  } else files[file.name] = await file.text();
  const sb = Object.keys(files).find(n => /_internal\.csv$/i.test(n));
  const sf = Object.keys(files).find(n => /internal_(all|html)\.csv$/i.test(n.split("/").pop()));
  let pages, source;
  if (sb) {
    source = "Sitebulb";
    pages = parseCSV(files[sb]).map(r => ({ url: r["URL"], status: cnum(r["HTTP Status Code"]), html: r["Content Type"] === "HTML", indexable: r["Indexable Status"] === "Indexable", idx: r["Indexable Status"] || "",
      title: r["Title"] === "--" ? "" : (r["Title"] || ""), meta: r["Meta Description"] === "--" ? "" : (r["Meta Description"] || ""), h1: r["H1"] === "--" ? "" : (r["H1"] || ""),
      words: cnum(r["No. Content Words"]), depth: cnum(r["Crawl Depth"]), resp: 0 }));
  } else {
    const key = sf || Object.keys(files)[0];
    const rows = parseCSV(files[key] || "");
    if (!rows.length || !("Address" in rows[0])) throw new Error("That file doesn't look like a Screaming Frog internal_all.csv or a Sitebulb export zip.");
    source = "Screaming Frog";
    pages = rows.map(r => ({ url: r["Address"], status: cnum(r["Status Code"]), html: /html/i.test(r["Content Type"] || ""), indexable: r["Indexability"] === "Indexable", idx: r["Indexability Status"] || r["Indexability"] || "",
      title: r["Title 1"] || "", meta: r["Meta Description 1"] || "", h1: r["H1-1"] || "", words: cnum(r["Word Count"]), depth: cnum(r["Crawl Depth"]), resp: cnum(r["Response Time"]) }));
  }
  const html = pages.filter(p => p.html && p.status === 200), idx = html.filter(p => p.indexable);
  const issues = {};
  const add = (k, urls) => { if (urls.length) { const [cat, sev, label, why] = CRAWL_ISSUES[k]; issues[k] = { key: k, cat, sev, label, why, count: urls.length, examples: urls.slice(0, 4) }; } };
  add("missing_title", idx.filter(p => !p.title).map(p => p.url));
  add("missing_meta", idx.filter(p => !p.meta).map(p => p.url));
  add("missing_h1", idx.filter(p => !p.h1).map(p => p.url));
  const tc = {}; idx.forEach(p => { if (p.title) tc[p.title] = (tc[p.title] || 0) + 1; });
  add("dup_title", idx.filter(p => p.title && tc[p.title] > 1).map(p => p.url));
  add("thin", idx.filter(p => p.words > 0 && p.words < 300).map(p => p.url));
  add("noindex", html.filter(p => /noindex/i.test(p.idx)).map(p => p.url));
  add("canonicalized", html.filter(p => /canonical/i.test(p.idx)).map(p => p.url));
  add("redirects", pages.filter(p => p.status >= 300 && p.status < 400).map(p => p.url));
  add("errors", pages.filter(p => p.status >= 400).map(p => p.url));
  add("deep", idx.filter(p => p.depth >= 4).map(p => p.url));
  add("slow", pages.filter(p => p.resp > 1).map(p => p.url));
  const order = { high: 0, medium: 1, low: 2 }, list = Object.values(issues).sort((a, b) => order[a.sev] - order[b.sev] || b.count - a.count);
  const score = crawlScore(list, idx.length);
  return { source, file: file.name, pages: pages.length, html: html.length, indexable: idx.length, score, issues: list };
}
