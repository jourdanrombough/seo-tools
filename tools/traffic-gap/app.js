"use strict";
/* Left on the Table · SEO market gap scanner
   Live mode: page served by server.py (credentials stay on your machine).
   Key mode: your own DataForSEO key, calls go straight from the browser.
   Demo mode: replay saved scans. */

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => Math.round(n || 0).toLocaleString();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function short(n) { n = n || 0; const a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toFixed(1) + "B"; if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M"; if (a >= 1e4) return Math.round(n / 1e3) + "K"; if (a >= 1e3) return (n / 1e3).toFixed(1) + "K"; return String(Math.round(n)); }
const money = n => "$" + short(n);
const API = "https://api.dataforseo.com/v3/";
const LANG = "en";
const EP = {
  overview: "dataforseo_labs/google/domain_rank_overview/live",
  ranked: "dataforseo_labs/google/ranked_keywords/live",
  forSite: "dataforseo_labs/google/keywords_for_site/live",
  related: "dataforseo_labs/google/related_keywords/live",
  suggest: "dataforseo_labs/google/keyword_suggestions/live",
  serpComp: "dataforseo_labs/google/serp_competitors/live",
  ads: "keywords_data/google_ads/search_volume/live",
  serp: "serp/google/organic/live/advanced",
};

/* ---------- geography ---------- */
const COUNTRIES = { us: { code: 2840, name: "United States" }, uk: { code: 2826, name: "United Kingdom" }, ca: { code: 2124, name: "Canada" }, au: { code: 2036, name: "Australia" } };
const STATES = [["Alabama", "AL"], ["Alaska", "AK"], ["Arizona", "AZ"], ["Arkansas", "AR"], ["California", "CA"], ["Colorado", "CO"], ["Connecticut", "CT"], ["Delaware", "DE"], ["District of Columbia", "DC"], ["Florida", "FL"], ["Georgia", "GA"], ["Hawaii", "HI"], ["Idaho", "ID"], ["Illinois", "IL"], ["Indiana", "IN"], ["Iowa", "IA"], ["Kansas", "KS"], ["Kentucky", "KY"], ["Louisiana", "LA"], ["Maine", "ME"], ["Maryland", "MD"], ["Massachusetts", "MA"], ["Michigan", "MI"], ["Minnesota", "MN"], ["Mississippi", "MS"], ["Missouri", "MO"], ["Montana", "MT"], ["Nebraska", "NE"], ["Nevada", "NV"], ["New Hampshire", "NH"], ["New Jersey", "NJ"], ["New Mexico", "NM"], ["New York", "NY"], ["North Carolina", "NC"], ["North Dakota", "ND"], ["Ohio", "OH"], ["Oklahoma", "OK"], ["Oregon", "OR"], ["Pennsylvania", "PA"], ["Rhode Island", "RI"], ["South Carolina", "SC"], ["South Dakota", "SD"], ["Tennessee", "TN"], ["Texas", "TX"], ["Utah", "UT"], ["Vermont", "VT"], ["Virginia", "VA"], ["Washington", "WA"], ["West Virginia", "WV"], ["Wisconsin", "WI"], ["Wyoming", "WY"]];
const CITIES = { "new york city": "NY", "nyc": "NY", "brooklyn": "NY", "manhattan": "NY", "queens": "NY", "bronx": "NY", "long island": "NY", "buffalo": "NY", "rochester": "NY", "albany": "NY", "los angeles": "CA", "san diego": "CA", "san francisco": "CA", "san jose": "CA", "sacramento": "CA", "fresno": "CA", "oakland": "CA", "riverside": "CA", "chicago": "IL", "houston": "TX", "dallas": "TX", "austin": "TX", "san antonio": "TX", "fort worth": "TX", "el paso": "TX", "phoenix": "AZ", "tucson": "AZ", "mesa": "AZ", "philadelphia": "PA", "pittsburgh": "PA", "jacksonville": "FL", "miami": "FL", "tampa": "FL", "orlando": "FL", "fort lauderdale": "FL", "columbus": "OH", "cleveland": "OH", "cincinnati": "OH", "indianapolis": "IN", "charlotte": "NC", "raleigh": "NC", "seattle": "WA", "spokane": "WA", "denver": "CO", "boston": "MA", "nashville": "TN", "memphis": "TN", "detroit": "MI", "portland": "OR", "las vegas": "NV", "louisville": "KY", "baltimore": "MD", "milwaukee": "WI", "albuquerque": "NM", "kansas city": "MO", "st louis": "MO", "atlanta": "GA", "omaha": "NE", "minneapolis": "MN", "new orleans": "LA", "tulsa": "OK", "oklahoma city": "OK", "salt lake city": "UT", "honolulu": "HI", "birmingham": "AL", "richmond": "VA", "virginia beach": "VA", "hartford": "CT", "providence": "RI", "newark": "NJ", "orange county": "CA", "daytona": "FL", "calgary": "AB", "edmonton": "AB", "alberta": "AB", "toronto": "ON", "ottawa": "ON", "montreal": "QC", "quebec": "QC", "winnipeg": "MB", "manitoba": "MB", "saskatchewan": "SK", "british columbia": "BC", "nova scotia": "NS", "london": "UK", "manchester uk": "UK", "sydney": "AU", "melbourne": "AU", "brisbane": "AU", "perth": "AU", "philly": "PA", "phila": "PA", "jersey city": "NJ", "paterson": "NJ", "trenton": "NJ", "camden": "NJ", "hoboken": "NJ", "wilmington": "DE", "charleston": "SC", "boise": "ID", "anchorage": "AK", "des moines": "IA", "little rock": "AR", "wichita": "KS", "jackson": "MS", "billings": "MT", "manchester": "NH", "fargo": "ND", "sioux falls": "SD", "burlington": "VT", "cheyenne": "WY", "washington dc": "DC" };
const STATE_CITY = { AL: "Birmingham", AK: "Anchorage", AZ: "Phoenix", AR: "Little Rock", CA: "Los Angeles", CO: "Denver", CT: "Hartford", DE: "Wilmington", DC: "Washington", FL: "Miami", GA: "Atlanta", HI: "Honolulu", ID: "Boise", IL: "Chicago", IN: "Indianapolis", IA: "Des Moines", KS: "Wichita", KY: "Louisville", LA: "New Orleans", ME: "Portland", MD: "Baltimore", MA: "Boston", MI: "Detroit", MN: "Minneapolis", MS: "Jackson", MO: "Kansas City", MT: "Billings", NE: "Omaha", NV: "Las Vegas", NH: "Manchester", NJ: "Newark", NM: "Albuquerque", NY: "New York", NC: "Charlotte", ND: "Fargo", OH: "Columbus", OK: "Oklahoma City", OR: "Portland", PA: "Philadelphia", RI: "Providence", SC: "Columbia", SD: "Sioux Falls", TN: "Nashville", TX: "Houston", UT: "Salt Lake City", VT: "Burlington", VA: "Virginia Beach", WA: "Seattle", WV: "Charleston", WI: "Milwaukee", WY: "Cheyenne" };
const AMBIGUOUS_ABBR = new Set(["in", "or", "me", "hi", "ok", "de", "id"]);
"new york:NY,los angeles:CA,chicago:IL,houston:TX,phoenix:AZ,philadelphia:PA,san antonio:TX,san diego:CA,dallas:TX,austin:TX,jacksonville:FL,fort worth:TX,columbus:OH,charlotte:NC,indianapolis:IN,san francisco:CA,seattle:WA,denver:CO,oklahoma city:OK,nashville:TN,el paso:TX,washington:DC,boston:MA,las vegas:NV,portland:OR,louisville:KY,memphis:TN,detroit:MI,baltimore:MD,milwaukee:WI,albuquerque:NM,tucson:AZ,fresno:CA,sacramento:CA,mesa:AZ,kansas city:MO,atlanta:GA,omaha:NE,colorado springs:CO,raleigh:NC,long beach:CA,virginia beach:VA,miami:FL,oakland:CA,minneapolis:MN,tulsa:OK,bakersfield:CA,wichita:KS,arlington:TX,aurora:CO,tampa:FL,new orleans:LA,cleveland:OH,honolulu:HI,anaheim:CA,lexington:KY,stockton:CA,corpus christi:TX,henderson:NV,riverside:CA,saint paul:MN,st paul:MN,santa ana:CA,cincinnati:OH,irvine:CA,orlando:FL,pittsburgh:PA,st louis:MO,saint louis:MO,greensboro:NC,lincoln:NE,anchorage:AK,plano:TX,durham:NC,buffalo:NY,chandler:AZ,chula vista:CA,toledo:OH,madison:WI,gilbert:AZ,reno:NV,fort wayne:IN,north las vegas:NV,st petersburg:FL,lubbock:TX,irving:TX,laredo:TX,winston salem:NC,chesapeake:VA,glendale:AZ,garland:TX,scottsdale:AZ,norfolk:VA,boise:ID,fremont:CA,spokane:WA,santa clarita:CA,baton rouge:LA,richmond:VA,hialeah:FL,san bernardino:CA,tacoma:WA,modesto:CA,huntsville:AL,des moines:IA,yonkers:NY,rochester:NY,moreno valley:CA,fayetteville:NC,fontana:CA,columbus ga:GA,worcester:MA,port st lucie:FL,little rock:AR,augusta:GA,oxnard:CA,birmingham:AL,montgomery:AL,frisco:TX,amarillo:TX,salt lake city:UT,grand rapids:MI,huntington beach:CA,overland park:KS,glendale ca:CA,tallahassee:FL,grand prairie:TX,mckinney:TX,cape coral:FL,sioux falls:SD,peoria:AZ,providence:RI,vancouver:WA,knoxville:TN,akron:OH,shreveport:LA,mobile:AL,brownsville:TX,newport news:VA,fort lauderdale:FL,chattanooga:TN,tempe:AZ,ontario:CA,cary:NC,eugene:OR,elk grove:CA,salem:OR,santa rosa:CA,clarksville:TN,rancho cucamonga:CA,springfield:MO,pembroke pines:FL,murfreesboro:TN,fort collins:CO,lancaster:CA,palmdale:CA,corona:CA,salinas:CA,killeen:TX,hayward:CA,alexandria:VA,hollywood:FL,macon:GA,kansas city ks:KS,lakewood co:CO,sunnyvale:CA,pasadena:CA,escondido:CA,joliet:IL,naperville:IL,rockford:IL,savannah:GA,bridgeport:CT,mesquite:TX,syracuse:NY,midland:TX,mcallen:TX,dayton:OH,orange:CA,olathe:KS,fullerton:CA,torrance:CA,denton:TX,thornton:CO,waco:TX,surprise:AZ,charleston:SC,west valley city:UT,visalia:CA,warren:MI,gainesville:FL,coral springs:FL,stamford:CT,cedar rapids:IA,sterling heights:MI,new haven:CT,columbia:SC,carrollton:TX,thousand oaks:CA,elizabeth:NJ,concord:CA,simi valley:CA,topeka:KS,victorville:CA,lafayette:LA,round rock:TX,abilene:TX,athens:GA,vallejo:CA,allentown:PA,evansville:IN,beaumont:TX,independence:MO,ann arbor:MI,provo:UT,lansing:MI,peoria il:IL,downey:CA,berkeley:CA,miami gardens:FL,costa mesa:CA,inglewood:CA,manchester:NH,elgin:IL,miramar:FL,odessa:TX,wilmington nc:NC,arvada:CO,westminster:CO,fairfield:CA,rochester mn:MN,carlsbad:CA,clearwater:FL,gresham:OR,pueblo:CO,high point:NC,west palm beach:FL,murrieta:CA,richardson:TX,temecula:CA,billings:MT,lowell:MA,antioch:CA,college station:TX,pompano beach:FL,boulder:CO,palm bay:FL,norman:OK,broken arrow:OK,green bay:WI,davenport:IA,wichita falls:TX,burbank:CA,ventura:CA,south bend:IN,lakeland:FL,el monte:CA,rialto:CA,las cruces:NM,league city:TX,tyler:TX,sugar land:TX,kent:WA,everett:WA,jurupa valley:CA,san mateo:CA,daly city:CA,gastonia:NC,kennesaw:GA,marietta:GA,sandy springs:GA,roswell:GA,boca raton:FL,delray beach:FL,naples:FL,sarasota:FL,ocala:FL,daytona beach:FL,kissimmee:FL,fort myers:FL,pensacola:FL,san jose:CA,long island:NY,brooklyn:NY,queens:NY,bronx:NY,staten island:NY,manhattan:NY,albany:NY,white plains:NY,scranton:PA,harrisburg:PA,reading:PA,bethlehem:PA,erie:PA,lancaster pa:PA,wilmington:DE,dover:DE,hartford:CT,stamford ct:CT,waterbury:CT,springfield ma:MA,cambridge:MA,quincy:MA,baltimore md:MD,silver spring:MD,rockville:MD,annapolis:MD,frederick:MD,norfolk va:VA,roanoke:VA,lynchburg:VA,greenville:SC,myrtle beach:SC,asheville:NC,knoxville tn:TN,jackson:MS,gulfport:MS,biloxi:MS,baton rouge la:LA,lake charles:LA,little rock ar:AR,tulsa ok:OK,kenner:LA,metairie:LA,san marcos:TX,the woodlands:TX,katy:TX,conroe:TX,pearland:TX,pasadena tx:TX,bakersfield ca:CA,long beach ca:CA,san bernardino ca:CA,palm springs:CA,santa monica:CA,beverly hills:CA,santa barbara:CA,san luis obispo:CA,redding:CA,chico:CA,eureka:CA,flagstaff:AZ,yuma:AZ,prescott:AZ,st george:UT,ogden:UT,orem:UT,boise id:ID,idaho falls:ID,missoula:MT,bozeman:MT,cheyenne:WY,casper:WY,fargo:ND,bismarck:ND,rapid city:SD,duluth:MN,bloomington:IN,carmel:IN,lafayette in:IN,toledo oh:OH,youngstown:OH,canton:OH,flint:MI,kalamazoo:MI,traverse city:MI,dearborn:MI,madison wi:WI,kenosha:WI,racine:WI,appleton:WI,des moines ia:IA,iowa city:IA,sioux city:IA,springfield il:IL,champaign:IL,aurora il:IL,schaumburg:IL,evanston:IL,st charles:MO,columbia mo:MO,lincoln ne:NE,lawrence:KS,manhattan ks:KS,albuquerque nm:NM,santa fe:NM,reno nv:NV,carson city:NV,tacoma wa:WA,bellevue:WA,olympia:WA,yakima:WA,bend:OR,medford:OR,juneau:AK,fairbanks:AK,hilo:HI,maui:HI,burlington vt:VT,portland me:ME,bangor:ME,nashua:NH,concord nh:NH,providence ri:RI,warwick:RI,charleston wv:WV,morgantown:WV,huntington:WV".split(",").forEach(x => { const [c, a] = x.split(":"); if (!(c in CITIES)) CITIES[c] = a; });
function geoFilter(loc, seeds) {
  if (!loc.region) {
    // nationwide market: leave out searches tied to a specific city or state, unless the seed itself names one
    if (loc.country !== "us" || !(seeds && seeds.length)) return () => true;
    const sd = seeds.join(" ");
    const names = [...STATES.map(s => s[0].toLowerCase()), ...Object.entries(CITIES).filter(([c, a]) => a.length === 2 && !["UK", "AU"].includes(a)).map(([c]) => c)].filter(n => !sd.includes(n) && !["washington", "orange", "mobile", "reading", "independence", "surprise", "bend", "kent", "normal", "columbia", "warren", "concord", "salem", "jackson", "springfield", "athens", "lafayette", "dover", "huntington", "lancaster", "glendale", "pasadena", "aurora", "arlington", "fairfield", "carmel", "quincy", "cambridge", "frederick", "greenville", "naples", "richmond", "columbus", "manhattan", "lincoln", "henderson", "independence", "midland", "orange county"].includes(n));
    const res = names.map(b => new RegExp("(^|\\s)" + b.replace(/\s+/g, "\\s+") + "($|\\s)"));
    return k => !res.some(r => r.test(k));
  }
  const mine = loc.abbr;
  const bad = [];
  STATES.forEach(([n, a]) => { if (a !== mine) { bad.push(n.toLowerCase()); if (!AMBIGUOUS_ABBR.has(a.toLowerCase())) bad.push(a.toLowerCase()); } });
  const COMMON = new Set(["orange", "mobile", "reading", "independence", "surprise", "bend", "kent", "normal", "columbia", "warren", "concord", "salem", "jackson", "springfield", "athens", "lafayette", "dover", "huntington", "lancaster", "ontario", "glendale", "pasadena", "aurora", "arlington", "lakewood", "fairfield", "carmel", "quincy", "cambridge", "frederick", "greenville", "roswell", "naples", "victorville", "provo", "lowell", "elgin", "manchester", "burlington", "richmond", "columbus"]);
  Object.entries(CITIES).forEach(([c, a]) => { if (a !== mine && !COMMON.has(c)) bad.push(c); });
  const mineName = loc.region.toLowerCase();
  const res = bad.filter(b => !mineName.includes(b)).map(b => new RegExp("(^|\\s)" + b.replace(/\s+/g, "\\s+") + "($|\\s)"));
  const own = new RegExp("(^|\\s)(" + [mineName, mine.toLowerCase()].join("|") + ")($|\\s)");
  return k => own.test(k) || !res.some(r => r.test(k));
}
const GEO_TOKENS = new Set();
STATES.forEach(([n, a]) => { n.toLowerCase().split(" ").forEach(t => GEO_TOKENS.add(t)); GEO_TOKENS.add(a.toLowerCase()); });
Object.keys(CITIES).forEach(c => c.split(" ").forEach(t => GEO_TOKENS.add(t)));
["usa", "us", "united", "states", "america", "uk", "canada", "australia", "near", "me", "nearby", "area", "local", "county", "city"].forEach(t => GEO_TOKENS.add(t));

const PLATFORMS = ["youtube.com", "reddit.com", "wikipedia.org", "yelp.com", "facebook.com", "linkedin.com", "instagram.com", "pinterest.com", "quora.com", "amazon.com", "tiktok.com", "x.com", "twitter.com", "forbes.com", "nolo.com", "findlaw.com", "justia.com", "avvo.com", "lawyers.com", "martindale.com", "superlawyers.com", "bbb.org", "yellowpages.com", "thumbtack.com", "angi.com", "homeadvisor.com", "indeed.com", "glassdoor.com", "etsy.com", "ebay.com", "medium.com", "healthline.com", "webmd.com", "mayoclinic.org", "nih.gov", "clevelandclinic.org", "tripadvisor.com", "expertise.com", "usnews.com", "nerdwallet.com", "investopedia.com", "walmart.com", "target.com", "homedepot.com", "lowes.com", "bing.com", "apple.com", "spotify.com"];
const isPlatform = d => PLATFORMS.some(p => d === p || d.endsWith("." + p)) || /\.gov$/.test(d);
const normDomain = d => String(d || "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[\/?#].*$/, "");

/* ---------- click model ---------- */
const CTR = [0, .22, .13, .09, .06, .045, .035, .028, .022, .018, .015];
const SUM10 = CTR.reduce((a, b) => a + b, 0);
const TOP3 = (CTR[1] + CTR[2] + CTR[3]) / 3;
const ctr = p => !p ? 0 : p <= 10 ? CTR[p] : p <= 20 ? .006 : 0;
const status = p => !p ? "none" : p <= 3 ? "top" : p <= 10 ? "page1" : p <= 20 ? "close" : "far";
const COLORS = { top: "#3ee98a", page1: "#2fd0ff", close: "#ffc13b", far: "#9b8cff", none: "#141735" };

/* ---------- mode / transport (api.php on optimizationtheory.com, or dev-server.py on the Mac) ---------- */
let MODE = "demo", LOGIN_URL = null, NONCE = "", CLAUDE = false, HEALTH = null;
const QS = new URLSearchParams(location.search), EMBED = QS.get("embed") === "1";
const apiUrl = (n, q) => "api.php?a=" + n + (q ? "&" + q : "");
async function api(n, body, q) {
  if (window.DEMO) return DEMO.api(n, body, q);
  const o = { credentials: "same-origin", cache: "no-store", headers: { "X-OT-Nonce": NONCE } };
  if (body !== undefined) { o.method = "POST"; o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(body); }
  const r = await fetch(apiUrl(n, q), o);
  const j = await r.json().catch(() => ({ error: "Bad response (" + r.status + ")" }));
  if (r.status === 401 || r.status === 403) j.error = j.error || "Log in again";
  return j;
}
async function detectMode() {
  if (location.protocol.startsWith("http")) {
    try { const j = await api("health"); HEALTH = j; if (j.mode === "local") { MODE = "local"; NONCE = j.nonce || ""; CLAUDE = !!(j.keys && j.keys.claude); } else if (j.login) LOGIN_URL = j.login; } catch (e) { }
  }
  renderMode();
}
function renderMode() {
  const m = $("#mode");
  m.className = "chip " + (MODE === "demo" ? "demo" : "live");
  m.lastElementChild.textContent = window.DEMO ? "demo · recorded run" : MODE === "local" ? "live" + (CLAUDE ? " · Claude AI" : " · backup AI") : "demo · saved scans";
  const kb = $("#keyBtn");
  kb.style.display = MODE === "local" || !LOGIN_URL ? "none" : "";
  kb.textContent = "Log in to scan"; kb.onclick = () => location.href = LOGIN_URL;
  if (MODE === "local") api("balance").then(j => { if (j.balance != null) { $("#bal").style.display = ""; $("#bal").textContent = "balance $" + j.balance.toFixed(2); } }).catch(() => { });
  updateEstimate();
  loadLists();
}

let SCAN = null, R = null, REPLAY = false, SPEED = 1, SKIP = false, STEP = null;
async function call(endpoint, task, label, quiet) {
  const t0 = performance.now();
  let r;
  try {
    if (MODE !== "local") throw new Error("No live connection");
    r = await api("dfs", { endpoint, task });
    if (r.error && r.status_code == null) r = { status_code: 0, status_message: r.error, cost: 0, result: null };
  } catch (e) { r = { status_code: 0, status_message: e.message, cost: 0, result: null }; }
  const secs = (performance.now() - t0) / 1000;
  SCAN.cost += r.cost || 0;
  SCAN.calls.push({ label, endpoint, cost: r.cost || 0, secs: +secs.toFixed(2), cached: !!r.cached, ok: r.status_code === 20000 });
  if (!quiet) log("→ " + label + "  " + (r.cached ? "cached" : "$" + (r.cost || 0).toFixed(4)) + " · " + secs.toFixed(1) + "s", "c");
  $("#scCost").textContent = "$" + (SCAN.cost + (SCAN.aiCost || 0)).toFixed(3);
  if (r.status_code !== 20000) { if (!quiet) log("  " + (r.status_message || "error"), "e"); return null; }
  return r.result;
}
/* Claude, direct: one named task on the server. Returns the JSON answer, or null to use the backup route. */
async function aiTask(name, data, label, quiet) {
  if (!CLAUDE) return null;
  const t0 = performance.now();
  let r;
  try { r = await api("ai", { task: name, data, note: SCAN.note || "" }); } catch (e) { r = { ok: false, fallback: true, error: e.message }; }
  const secs = (performance.now() - t0) / 1000;
  SCAN.aiCost = (SCAN.aiCost || 0) + (r.cost || 0);
  SCAN.calls.push({ label, endpoint: "claude:" + name, cost: r.cost || 0, secs: +secs.toFixed(2), cached: !!r.cached, ok: !!r.ok });
  if (!quiet) log("→ " + label + "  " + (r.cached ? "cached" : "$" + (r.cost || 0).toFixed(4)) + " · " + secs.toFixed(1) + "s · " + (r.model || "claude"), "c");
  $("#scCost").textContent = "$" + (SCAN.cost + SCAN.aiCost).toFixed(3);
  if (r.ok) { SCAN.aiModel = r.model; return r.json; }
  log("  Claude: " + (r.error || "no answer") + (r.fallback ? " · switching to the backup AI" : ""), "w");
  if (r.fallback && !/JSON/.test(r.error || "")) CLAUDE = false;
  return null;
}

/* ---------- log ---------- */
function log(text, cls, record = true) {
  const d = document.createElement("div"); d.className = cls || ""; d.textContent = text;
  const L = $("#log"); L.appendChild(d); while (L.children.length > 60) L.removeChild(L.firstChild);
  if (record && SCAN && !REPLAY) SCAN.log.push([STEP, cls || "", text]);
}

/* ---------- form ---------- */
function initForm() {
  const c = $("#inCountry"); c.innerHTML = Object.entries(COUNTRIES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("");
  const r = $("#inRegion"); r.innerHTML = `<option value="">Nationwide</option>` + STATES.map(([n, a]) => `<option value="${a}">${n}</option>`).join("");
  ["#inDomain", "#inKw", "#inRegion", "#inCountry"].forEach(s => $(s).addEventListener("input", updateEstimate));
}
function syncRegion() { $("#regionBox").style.visibility = $("#inCountry").value === "us" ? "visible" : "hidden"; if ($("#inCountry").value !== "us") $("#inRegion").value = ""; updateEstimate(); }
function readLocation() {
  const cc = $("#inCountry").value, a = $("#inRegion").value;
  const st = STATES.find(s => s[1] === a);
  const loc = { country: cc, code: COUNTRIES[cc].code, region: st ? st[0] : null, abbr: st ? st[1] : null };
  loc.label = st ? st[0] : COUNTRIES[cc].name;
  loc.ads = st ? `${st[0]},United States` : null;
  loc.city = st && STATE_CITY[st[1]] ? STATE_CITY[st[1]] + ", " + st[1] : null;
  loc.serp = st && STATE_CITY[st[1]] ? `${STATE_CITY[st[1]]},${st[0]},United States` : null;
  return loc;
}
function updateEstimate() {
  const kw = $("#inKw").value.trim(), loc = readLocation();
  const seeds = kw ? kw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3) : [];
  let c = 0.025 + 0.035 + 0.05 + (seeds.length ? 0.22 : 0.17);
  if (loc.region) c += 0.09 + 0.08 + 0.03;
  const live = MODE !== "demo"; c += CLAUDE ? 0.04 : 0.03;
  $("#est").innerHTML = `<span>⏱ <b>about ${loc.region ? 90 : 60} seconds</b> · AI-guided</span><span>≈ <b>$${c.toFixed(2)}</b> in DataForSEO${CLAUDE ? " + Claude" : ""} credits</span><span>${seeds.length ? `market: <b>${esc(seeds.join(", "))}</b>` : "market: <b>keywords related to the site</b>"}${loc.region ? ` · volumes for <b>${esc(loc.region)}</b>` : ""}</span>` + (live ? "" : `<span style="color:var(--gold)">${LOGIN_URL ? "Log in to run live scans." : "Live scans run on optimizationtheory.com or the dev server."} Try an example below.</span>`);
}

/* ---------- lists ---------- */
async function loadLists() {
  try {
    const ex = await (await fetch("examples/index.json", { cache: "no-store" })).json();
    $("#examples").innerHTML = ex.length ? ex.map(rowHTML).join("") : `<div class="empty">No examples yet.</div>`;
  } catch (e) { $("#examples").innerHTML = `<div class="empty">No examples found.</div>`; }
  if (MODE === "local") {
    try {
      const rs = await api("list", undefined, "kind=scans");
      $("#recent").innerHTML = Array.isArray(rs) && rs.length ? rs.map(s => rowHTML({ ...s, file: "scan:" + s.id })).join("") : `<div class="empty">Scans you run are saved here.</div>`;
    } catch (e) { }
  } else $("#recent").innerHTML = `<div class="empty">${LOGIN_URL ? "Log in to run live scans. They're saved here." : "Live scans you run are saved here."}</div>`;
  document.querySelectorAll(".scanrow").forEach(el => el.onclick = () => openFile(el.dataset.file, true));
}
function rowHTML(s) { return `<div class="scanrow" data-file="${esc(s.file)}"><div><b>${esc(s.domain)}</b><span>${esc(s.keyword || "site keywords")} · ${esc(s.location || "")}${s.date ? " · " + esc(s.date.slice(0, 10)) : ""}</span></div><div class="pl">${s.headline ? esc(s.headline) : "▶ replay"}</div></div>`; }
async function loadFile(file) {
  if (file.startsWith("scan:")) { const d = await api("get", undefined, "kind=scans&id=" + encodeURIComponent(file.slice(5))); if (d.error) throw new Error(d.error); return d; }
  if (!/^examples\/[\w.\-]+\.json$/.test(file)) throw new Error("bad file");
  return await (await fetch(file, { cache: "no-store" })).json();
}
async function openFile(file, animate) {
  try {
    const d = await loadFile(file);
    if (!EMBED) location.hash = (animate ? "open=" : "show=") + file;
    SCAN_ID = file.startsWith("scan:") ? file.slice(5) : null;
    if (animate) replay(d); else { SCAN = d; R = compute(SCAN); if (EMBED) return postDigest(); showResults(true); }
  } catch (e) { showErr("Couldn't open " + file); if (EMBED) parent.postMessage({ type: "ot-scan-error", error: "Couldn't open the saved scan" }, location.origin); }
}
function showErr(m) { const e = $("#err"); e.textContent = m; e.style.display = m ? "block" : "none"; }

/* ---------- pipeline ---------- */
/* ---------- AI (runs through DataForSEO's LLM endpoint: no extra key needed) ---------- */
/* backup AI route: Claude through DataForSEO's LLM endpoint (500-character prompts, so work goes in small batches) */
const AI_EP = "ai_optimization/claude/llm_responses/live", AI_MODEL = "claude-haiku-4-5";
const AI_EP2 = "ai_optimization/chat_gpt/llm_responses/live", AI_MODEL2 = "gpt-5.4-mini";
async function ai(system, user, label, quiet) {
  const task = m => ({ system_message: system.slice(0, 500), user_prompt: user.slice(0, 500), model_name: m, web_search: false });
  SCAN.aiModel = SCAN.aiModel || AI_MODEL + " (via DataForSEO)";
  let r = await call(AI_EP, task(AI_MODEL), label, quiet);
  if (!r) r = await call(AI_EP2, task(AI_MODEL2), label + " (backup model)", quiet);
  let txt = ""; (r?.[0]?.items || []).forEach(it => (it.sections || []).forEach(s => { if (s.type === "text") txt += s.text || ""; }));
  const m = txt.match(/\{[\s\S]*\}/); if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { try { return JSON.parse(m[0].replace(/,\s*([}\]])/g, "$1")); } catch (e2) { return null; } }
}
// fit the SEO's note into a 500-character backup prompt, ahead of the reply format
function withNote(sys) { const n = (SCAN.note || "").trim(); if (!n) return sys.slice(0, 500); const i = sys.lastIndexOf(" Reply ONLY JSON"); const head = i > 0 ? sys.slice(0, i) : sys, tail = i > 0 ? sys.slice(i) : ""; const room = 500 - head.length - tail.length - 8; return room > 20 ? head + " Note: " + n.slice(0, room) + tail : sys.slice(0, 500); }
async function pool(jobs, n) { const out = new Array(jobs.length); let i = 0; await Promise.all([...Array(Math.min(n, jobs.length))].map(async () => { while (i < jobs.length) { const j = i++; out[j] = await jobs[j](); } })); return out; }
function packLines(items, fmtLine, max = 490) { const out = []; let cur = [], len = 0; items.forEach((x, j) => { const l = fmtLine(x, cur.length + 1) + "\n"; if (len + l.length > max && cur.length) { out.push(cur); cur = []; len = 0; } cur.push(x); len += (fmtLine(x, cur.length) + "\n").length; }); if (cur.length) out.push(cur); return out; }

/* ---------- pipeline ---------- */
const STEPS = [
  { id: "foot", label: "Footprint", min: 4, head: () => "Measuring the site's current search footprint" },
  { id: "brain", label: "AI · business", min: 5, ai: true, head: () => "AI is reading the site to understand the business" },
  { id: "market", label: "Market map", min: 5, head: () => `Mapping every search across ${(SCAN.aiSeeds || SCAN.seeds || []).length || "the"} service${(SCAN.aiSeeds || SCAN.seeds || []).length === 1 ? "" : "s"}` },
  { id: "filter", label: "AI · relevance", min: 6, ai: true, head: () => "AI is checking every search for relevance" },
  { id: "local", label: "Local demand", min: 3, local: true, head: () => `Sizing local demand in ${SCAN.location.region}` },
  { id: "comp", label: "Competitors", min: 5, head: () => "Finding who owns the market" },
  { id: "serp", label: "Live results", min: 4, local: true, head: () => `Checking live Google results in ${SCAN.location.city || SCAN.location.region}` },
  { id: "gap", label: "The gap", min: 7, head: () => "Computing the traffic competitors take from you" },
  { id: "proj", label: "Projection", min: 6, head: () => "Projecting the next 12 months" },
];
function activeSteps() { return STEPS.filter(s => (!s.local || SCAN.location.region) && (!s.ai || !REPLAY || SCAN.ai)); }
function stepUI(id) {
  STEP = id;
  const st = activeSteps(), i = st.findIndex(s => s.id === id);
  $("#scSteps").style.gridTemplateColumns = `repeat(${st.length},minmax(0,1fr))`;
  $("#scSteps").innerHTML = st.map((s, j) => `<div class="${j < i ? "done" : j === i ? "on" : ""}${s.ai ? " ai" : ""}">${String(j + 1).padStart(2, "0")} · ${s.label}</div>`).join("");
  $("#scEye").innerHTML = `step ${i + 1} of ${st.length}${st[i].ai ? ' · <span style="color:var(--violet)">AI</span>' : ""}`;
  $("#scHead").textContent = st[i].head();
  log(st[i].head(), "s", false);
}

const GENERIC = new Set("a an the of for in on to and or is are was be my me near nearby best top cheap cheapest affordable local free how what who when where why which can do does should i you your vs versus with without from by at about lawyer lawyers attorney attorneys law firm firms company companies service services online cost costs price prices pricing 2023 2024 2025 2026 2027 good great reviews review rated number phone open now hours".split(" "));

const TOPIC_OK = new Set(["company", "companies", "service", "services", "local", "online", "agency", "agencies"]);
const toks = k => k.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
const SYN = { attorney: "lawyer", attorneys: "lawyer", lawyers: "lawyer", firms: "firm" };
const STOPW = new Set(["for", "a", "an", "the", "of", "in", "to", "and", "by", "with", "on", "at", "from", "is"]);
const sig = k => [...new Set(toks(k.replace(/-/g, " ")).map(t => SYN[t] || (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t)).filter(t => !STOPW.has(t)))].sort().join(" ");
const JUNK = /\b(salary|salaries|jobs?|hiring|career|school|degree|course|memes?|movies?|tv show|cast|song|lyrics|game|wiki|definition|meaning|reddit|pdf|template|crossword|tiktok|cartoon|jokes?|net worth|collections?|website|login|phone number|wikipedia|lawsuit against)\b|\b(do|does|did) .*\bmake\b|\bmake (per|a year|an hour)\b/;
// Low-volume searches often have no CPC. Use the market's median CPC for them and mark it as an estimate.
function fillCpc(U) {
  const cs = U.filter(u => u.c > 0 && !u.ce).map(u => u.c).sort((a, b) => a - b);
  const med = cs.length ? cs[Math.floor(cs.length / 2)] : 0;
  U.forEach(u => { if (!(u.c > 0)) { u.c = med; u.ce = med > 0; } });
}
// Google reports one volume for a cluster of close variants. Count each cluster once.
function mergeClusters(U, minV) {
  const by = {}, out = [];
  U.slice().sort((a, b) => b.v - a.v || a.k.length - b.k.length).forEach(u => {
    const key = u.v >= minV ? u.v + "|" + u.c : null;
    const ks = "s|" + sig(u.k);
    const hit = (key && by[key]) || by[ks];
    if (hit) { hit.vars = (hit.vars || 0) + 1; (hit.alt = hit.alt || []).push(u.k); return; }
    if (key) by[key] = u; by[ks] = u; out.push(u);
  });
  return out;
}

async function startScan() {
  showErr("");
  const domain = normDomain($("#inDomain").value);
  if (!domain || !domain.includes(".")) return showErr("Enter a domain like example.com");
  if (MODE === "demo") { if (LOGIN_URL && !EMBED) { location.href = LOGIN_URL; return; } return showErr("Live scans need you logged in on optimizationtheory.com (or the dev server on your Mac)."); }
  const kw = $("#inKw").value.trim().toLowerCase();
  const seeds = kw ? kw.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3) : [];
  SCAN = { v: 3, domain, keyword: seeds.join(", "), seeds, note: ($("#inNote").value || "").trim().slice(0, 600), location: readLocation(), date: new Date().toISOString(), cost: 0, calls: [], log: [], durations: {}, overview: null, ranked: [], universe: [], comps: [], youPos: {}, serps: [], dropped: [] };
  REPLAY = false; SKIP = false; SPEED = 1;
  openOverlay();
  const t0 = performance.now();
  try {
    for (const s of activeSteps()) {
      const ts = performance.now();
      stepUI(s.id);
      await RUN[s.id]();
      const el = performance.now() - ts;
      const minMs = s.min * 1000;
      if (el < minMs) await sleep(minMs - el);
      SCAN.durations[s.id] = +((performance.now() - ts) / 1000).toFixed(2);
      if (s.id === "foot" && !SCAN.ranked.length && !SCAN.overview) throw new Error("No data came back for " + domain + ". Check the domain and your API connection.");
      if ((s.id === "market" || s.id === "filter") && !SCAN.universe.length) throw new Error("Couldn't find relevant searches for this market. Try a different target keyword.");
    }
  } catch (e) { console.error(e); log("✗ " + e.message, "e"); await sleep(1800); closeOverlay(); showErr(e.message); if (EMBED) parent.postMessage({ type: "ot-scan-error", error: e.message }, location.origin); return; }
  SCAN.runtime = +((performance.now() - t0) / 1000).toFixed(1);
  SCAN.headline = "+" + short(scenarios(R).exp.gain) + " visits/mo possible";
  SCAN_ID = null;
  try { const j = await api("save", { kind: "scans", data: SCAN }); if (j.id) { SCAN_ID = j.id; if (!EMBED) location.hash = "show=scan:" + j.id; } } catch (e) { }
  finishOverlay();
  if (EMBED) { await sleep(window.DEMO ? 900 : 2600); postDigest(); }
}

function parseKw(map, k, info, props, intent, seed) {
  k = (k || "").toLowerCase().trim(); if (!k || !info || JUNK.test(k) || intent === "navigational") return 0;
  const v = info.search_volume || 0; if (v < 10) return 0;
  if (!map[k] || v > map[k].v) map[k] = { k, v, c: +(info.cpc || 0).toFixed(2), d: props?.keyword_difficulty ?? null, i: intent || null, s: seed };
  return 1;
}

const RUN = {
  async foot() {
    const S = SCAN, L = { location_code: S.location.code, language_code: LANG };
    const [ov, rk] = await Promise.all([
      call(EP.overview, { target: S.domain, ...L }, "Domain overview"),
      call(EP.ranked, { target: S.domain, ...L, limit: 700, order_by: ["ranked_serp_element.serp_item.etv,desc"] }, "Ranked keywords (top 700 by traffic)")]);
    const m = ov?.[0]?.items?.[0]?.metrics?.organic || {};
    S.overview = { etv: m.etv || 0, count: m.count || 0, top3: (m.pos_1 || 0) + (m.pos_2_3 || 0), p10: m.pos_4_10 || 0, p20: m.pos_11_20 || 0, value: m.estimated_paid_traffic_cost || 0 };
    const map = {};
    (rk?.[0]?.items || []).forEach(it => {
      const kd = it.keyword_data || {}, info = kd.keyword_info || {}, se = it.ranked_serp_element?.serp_item || {};
      const k = (kd.keyword || "").toLowerCase(); if (!k || !se.rank_group) return;
      if (!map[k] || se.rank_group < map[k].p) map[k] = { k, p: se.rank_group, v: info.search_volume || 0, c: +(info.cpc || 0).toFixed(2), d: kd.keyword_properties?.keyword_difficulty ?? null, u: se.relative_url || se.url || "" };
    });
    S.ranked = Object.values(map);
    log(`✓ ${fmt(S.overview.count)} keywords ranking · ~${fmt(S.overview.etv)} visits/mo · ${S.overview.top3} in the top 3`, "ok");
    VIZ.foot();
  },
  async brain() {
    const S = SCAN;
    const top = S.ranked.slice().sort((a, b) => b.v - a.v).slice(0, 16).map(r => r.k);
    const sys = 'You are an SEO strategist. From a domain, its top ranking searches and an optional target, infer the business and what its buyers search for. Reply ONLY JSON: {"biz":"10 words max","services":["4 to 6 short buyer search phrases in the same market as the target, no place names"],"exclude":["up to 5 off-topic themes"]}';
    let u = `domain: ${S.domain}\n${S.keyword ? "target: " + S.keyword + "\n" : ""}${S.location.region ? "state: " + S.location.region + "\n" : ""}ranks for: `;
    for (const k of top) { if ((u + k + "; ").length > 495) break; u += k + "; "; }
    VIZ.brain(top);
    let j = await aiTask("brain", { domain: S.domain, target: S.keyword || null, serves: S.location.region ? S.location.region + ", " + COUNTRIES[S.location.country].name : COUNTRIES[S.location.country].name, ranks_for: S.ranked.slice().sort((a, b) => b.v - a.v).slice(0, 40).map(r => r.k) }, "Claude: understand the business");
    if (!j) { if (S.note) u = ("note: " + S.note.slice(0, 160) + "\n" + u).slice(0, 500); j = await ai(sys, u, "AI: understand the business"); }
    const services = (Array.isArray(j?.services) ? j.services : []).map(x => String(x).toLowerCase().replace(/[^a-z0-9 '&-]/g, "").trim()).filter(x => x && x.length < 60).slice(0, 6);
    S.ai = { biz: String(j?.biz || "").slice(0, 90), services, exclude: (Array.isArray(j?.exclude) ? j.exclude : []).slice(0, 6).map(String), audience: String(j?.audience || "").slice(0, 90), model: SCAN.aiModel || AI_MODEL };
    const seeds = [...S.seeds];
    services.forEach(x => { if (!seeds.some(s => sig(s) === sig(x)) && seeds.length < 6) seeds.push(x); });
    S.aiSeeds = seeds;
    if (S.ai.biz) log(`✓ ${S.ai.biz}`, "ok"); else log("  AI couldn't read the business; using rules only", "w");
    if (services.length) log(`✓ AI will also map: ${services.join(" · ")}`, "ok");
    VIZ.brainDone();
  },
  async market() {
    const S = SCAN, L = { location_code: S.location.code, language_code: LANG }, jobs = [], labels = [];
    const seeds = (S.aiSeeds && S.aiSeeds.length ? S.aiSeeds : S.seeds).slice(0, 6);
    const sugg = (kw, limit, lab) => call(EP.suggest, { keyword: kw, ...L, limit, include_seed_keyword: true, ignore_synonyms: true, order_by: ["keyword_info.search_volume,desc"], filters: [["keyword_info.search_volume", ">", 0]] }, lab);
    seeds.forEach((s, n) => {
      const main = S.seeds.includes(s);
      jobs.push(sugg(s, main ? 250 : 120, "Suggestions: " + s)); labels.push(s);
      jobs.push(call(EP.related, { keyword: s, ...L, depth: main ? 3 : 2, limit: main ? 300 : 120, ignore_synonyms: true, filters: [["keyword_data.keyword_info.search_volume", ">", 0]] }, "Related searches: " + s)); labels.push(s);
      if (main && S.location.region) {
        jobs.push(sugg(s + " " + S.location.region.toLowerCase(), 150, `Suggestions: ${s} ${S.location.region.toLowerCase()}`)); labels.push(s);
        jobs.push(sugg(s + " " + S.location.abbr.toLowerCase(), 100, `Suggestions: ${s} ${S.location.abbr.toLowerCase()}`)); labels.push(s);
      }
    });
    if (!S.seeds.length) { jobs.push(call(EP.forSite, { target: S.domain, ...L, limit: 300, filters: [["keyword_info.search_volume", ">", 10]] }, "Keywords relevant to the site")); labels.push(S.domain); }
    VIZ.market(seeds.length ? seeds : [S.domain]);
    const res = await Promise.all(jobs);
    const map = {}; S.seedCounts = {};
    res.forEach((r, j) => {
      const r0 = r?.[0]; if (!r0) return; let n = 0; const sd = labels[j];
      if (r0.seed_keyword_data) n += parseKw(map, r0.seed_keyword_data.keyword, r0.seed_keyword_data.keyword_info, r0.seed_keyword_data.keyword_properties, r0.seed_keyword_data.search_intent_info?.main_intent, sd);
      (r0.items || []).forEach(it => { const x = it.keyword_data || it; n += parseKw(map, x.keyword, x.keyword_info, x.keyword_properties, x.search_intent_info?.main_intent, sd); });
      S.seedCounts[sd] = (S.seedCounts[sd] || 0) + n;
    });
    const core = new Set(seeds.flatMap(toks).filter(t => !GENERIC.has(t) && !GEO_TOKENS.has(t)));
    S.ranked.forEach(r => {
      if (r.v < 10) return;
      if (S.seeds.length && !toks(r.k).some(t => core.has(t))) return;
      if (!map[r.k]) map[r.k] = { k: r.k, v: r.v, c: r.c, d: r.d, i: null, s: "your rankings" };
    });
    const geo = geoFilter(S.location, seeds);
    let U = Object.values(map).filter(u => geo(u.k));
    S.geoDropped = Object.keys(map).length - U.length;
    const before = U.length;
    U = mergeClusters(U, S.location.region ? 1e12 : 200);
    S.merged = before - U.length;
    U.sort((a, b) => b.v - a.v);
    S.universe = U.slice(0, 900);
    fillCpc(S.universe);
    log(`✓ ${fmt(S.universe.length)} distinct searches · ${fmt(S.universe.reduce((a, u) => a + u.v, 0))} searches/mo` + (S.merged ? ` · ${S.merged} duplicate variants merged` : "") + (S.geoDropped ? ` · ${S.geoDropped} other-location searches removed` : ""), "ok");
    VIZ.marketDone();
  },
  async filter() {
    const S = SCAN, A = S.ai || {};
    if (!A.biz) { log("  AI unavailable, keeping rule-based filters", "w"); return; }
    const svc = (A.services || []).join(", ").slice(0, 110);
    const sys = withNote(`Business: ${A.biz.slice(0, 70)}.${S.location.region ? " Serves " + S.location.region + "." : ""} Services: ${svc}. Keep a search if the searcher could become a customer or is researching what it sells. Drop: other locations, jobs/salary/school, brand or celebrity names, unrelated topics. Reply ONLY JSON {"keep":[ids],"drop":{"id":"geo|job|brand|off"}}`);
    const list = S.universe.slice(0, CLAUDE ? 600 : 450);
    VIZ.filter(list);
    let res = null, nChecks = 0;
    if (CLAUDE) {
      const big = []; for (let i = 0; i < list.length; i += 150) big.push(list.slice(i, i + 150));
      const out = await pool(big.map((b, j) => async () => {
        const searches = {}; b.forEach((x, i) => searches[i + 1] = x.k);
        const r = await aiTask("filter", { business: A.biz, services: A.services, audience: A.audience || null, serves: S.location.region || COUNTRIES[S.location.country].name, not_customers: A.exclude, searches }, `Claude relevance check ${j + 1}/${big.length} (${b.length} searches)`);
        if (!r || typeof r.drop !== "object") return null;
        const why = {}; Object.entries(r.drop || {}).forEach(([n, w]) => why[+n] = String(w));
        for (let i = 0; i < b.length; i++) { const ok = !why[i + 1]; VIZ.filterMark(b[i].k, ok, ok ? null : why[i + 1]); if (i % 6 === 0) await sleep(12); }
        return b.map((x, i) => ({ x, ok: !why[i + 1], why: why[i + 1] || "off" }));
      }), 4);
      if (out.filter(Boolean).length >= out.length / 2) { res = out.map((r, j) => r || big[j].map(x => ({ x, ok: true, why: "off" }))); nChecks = big.length; }
    }
    const batches = res ? [] : packLines(list, (x, i) => `${i} ${x.k}`);
    let done = 0;
    if (!res) res = await pool(batches.map((b, j) => async () => {
      const user = b.map((x, i) => `${i + 1} ${x.k}`).join("\n");
      const r = await ai(sys, user, `AI relevance check ${j + 1}/${batches.length}`, true);
      done++; $("#scCost").textContent = "$" + SCAN.cost.toFixed(3);
      const keep = new Set(), why = {};
      if (r && Array.isArray(r.keep)) { r.keep.forEach(n => keep.add(+n)); Object.entries(r.drop || {}).forEach(([n, w]) => why[+n] = String(w)); }
      else b.forEach((x, i) => keep.add(i + 1));
      b.forEach((x, i) => { const ok = keep.has(i + 1); VIZ.filterMark(x.k, ok, ok ? null : (why[i + 1] || "off")); });
      return b.map((x, i) => ({ x, ok: keep.has(i + 1), why: why[i + 1] || "off" }));
    }), 8);
    const flat = res.flat();
    const kept = flat.filter(r => r.ok).map(r => r.x);
    S.dropped = flat.filter(r => !r.ok).map(r => ({ k: r.x.k, v: r.x.v, why: ["geo", "job", "brand", "off"].includes(r.why) ? r.why : "off" }));
    if (kept.length < 10) { log("  AI kept too few searches; keeping the full list", "w"); S.dropped = []; return; }
    S.aiChecked = flat.length;
    S.universe = kept;
    const by = {}; S.dropped.forEach(d => by[d.why] = (by[d.why] || 0) + 1);
    const nm = { geo: "other locations", job: "jobs & careers", brand: "brand names", off: "off-topic" };
    log(`✓ AI kept ${fmt(kept.length)} of ${fmt(flat.length)} searches (${nChecks || batches.length} checks)`, "ok");
    if (S.dropped.length) log(`  dropped: ${Object.entries(by).map(([k, n]) => n + " " + nm[k]).join(", ")}`, "w");
  },
  async local() {
    const S = SCAN;
    const ok = k => /^[a-z0-9 '&.\-]+$/.test(k) && k.length <= 80 && k.split(" ").length <= 10;
    const kws = S.universe.map(u => u.k).filter(ok).slice(0, 1000);
    const res = await call(EP.ads, { location_name: S.location.ads, language_code: LANG, keywords: kws }, "Google Ads volumes: " + S.location.region);
    if (!res) { log("  kept national volumes", "w"); S.localFailed = true; return; }
    const loc = {}; res.forEach(x => { if (x && x.keyword) loc[x.keyword.toLowerCase()] = x; });
    const ratios = [];
    S.universe.forEach(u => { const x = loc[u.k]; if (x && x.search_volume && u.v) ratios.push(x.search_volume / u.v); });
    ratios.sort((a, b) => a - b);
    const ratio = ratios.length ? ratios[Math.floor(ratios.length * 0.25)] : 0.03;
    const natTotal = S.universe.reduce((a, u) => a + u.v, 0);
    S.universe.forEach(u => {
      const x = loc[u.k]; u.nv = u.v;
      if (x && x.search_volume != null) { u.v = x.search_volume; if (x.cpc) { u.c = +x.cpc.toFixed(2); u.ce = false; } }
      else { u.v = Math.round(u.v * ratio); u.ve = true; }
    });
    const n0 = S.universe.length;
    S.universe = mergeClusters(S.universe.filter(u => u.v > 0), 100).sort((a, b) => b.v - a.v);
    S.merged = (S.merged || 0) + (n0 - S.universe.length);
    S.localRatio = +ratio.toFixed(4);
    S.localTotals = { nat: natTotal, loc: S.universe.reduce((a, u) => a + u.v, 0) };
    fillCpc(S.universe);
    log(`✓ ${fmt(S.localTotals.loc)} searches/mo in ${S.location.region} (vs ${fmt(natTotal)} nationwide) · ${fmt(S.universe.length)} distinct searches`, "ok");
    VIZ.local();
  },
  async comp() {
    const S = SCAN, L = { location_code: S.location.code, language_code: LANG };
    const idx = {}; S.universe.forEach((u, i) => idx[u.k] = i);
    const core = S.universe.map((u, i) => ({ u, i })).sort((a, b) => b.u.v - a.u.v).slice(0, 800);
    const batches = []; for (let i = 0; i < core.length; i += 200) batches.push(core.slice(i, i + 200));
    const res = await Promise.all(batches.map((b, j) => call(EP.serpComp, { keywords: b.map(x => x.u.k), ...L, limit: 100, item_types: ["organic"], include_subdomains: true }, `Who ranks: batch ${j + 1} of ${batches.length} (${b.length} searches)`)));
    const doms = {};
    res.forEach(r => (r?.[0]?.items || []).forEach(it => {
      const d = normDomain(it.domain); if (!d || d === "google.com") return;
      const o = doms[d] || (doms[d] = { d, etv: 0, pos: {} });
      o.etv += it.etv || 0;
      Object.entries(it.keywords_positions || {}).forEach(([k, arr]) => {
        const i = idx[k.toLowerCase()]; if (i == null) return;
        const p = Math.min(...(arr || []).filter(Number.isFinite)); if (!Number.isFinite(p)) return;
        if (!o.pos[i] || p < o.pos[i]) o.pos[i] = p;
      });
    }));
    const mine = d => d === S.domain || d.endsWith("." + S.domain);
    Object.values(doms).filter(o => mine(o.d)).forEach(o => Object.entries(o.pos).forEach(([i, p]) => { if (!S.youPos[i] || p < S.youPos[i]) S.youPos[i] = p; }));
    S.comps = Object.values(doms).filter(o => !mine(o.d)).sort((a, b) => b.etv - a.etv).slice(0, 40).map(o => ({ d: o.d, pos: o.pos }));
    log(`✓ ${Object.keys(doms).length} domains compete · leaders: ${S.comps.slice(0, 3).map(c => c.d).join(", ")}`, "ok");
    VIZ.comp();
  },
  async serp() {
    const S = SCAN;
    const top = S.universe.map((u, i) => ({ u, i })).filter(x => x.u.v > 0).sort((a, b) => b.u.v * Math.max(b.u.c, .5) - a.u.v * Math.max(a.u.c, .5)).slice(0, 20);
    const mine = d => d === S.domain || d.endsWith("." + S.domain);
    await Promise.all(top.map(async (x, j) => {
      const r = await call(EP.serp, { keyword: x.u.k, location_name: S.location.serp || S.location.ads, language_code: LANG, depth: 20, device: "desktop" }, "Live Google: " + x.u.k);
      const items = r?.[0]?.items; if (!items) return;
      const org = [], lp = []; let ads = 0, aio = false;
      items.forEach(it => {
        if (it.type === "organic" && org.length < 20) org.push([normDomain(it.domain), it.rank_group]);
        else if (it.type === "local_pack") lp.push([it.title || "", normDomain(it.domain || it.url || "")]);
        else if (it.type === "paid") ads++;
        else if (it.type === "ai_overview") aio = true;
      });
      const you = org.find(o => mine(o[0]));
      const s = { i: x.i, k: x.u.k, org, lp: lp.slice(0, 3), ads, ai: aio, you: you ? you[1] : null, youLp: lp.some(l => mine(l[1])) };
      S.serps.push(s); VIZ.serpTile(s);
      log(`  ${x.u.k}: ${you ? "you're #" + you[1] : "you're not in the top 20"} · #1 ${org[0] ? org[0][0] : "–"}${lp.length ? " · map pack" : ""}`, you && you[1] <= 3 ? "ok" : "w");
    }));
  },
  async gap() {
    R = compute(SCAN);
    const top = R.comps.slice(0, 18).map(c => c.d);
    VIZ.gapStart();
    if (SCAN.ai && SCAN.ai.biz && top.length) {
      const types = {};
      const cj = await aiTask("vet", { business: SCAN.ai.biz, services: SCAN.ai.services, domains: top }, "Claude: vet competitors");
      if (cj && cj.t) Object.entries(cj.t).forEach(([d, t]) => { d = normDomain(d); if (top.includes(d)) types[d] = ["direct", "directory", "media", "other"].includes(t) ? t : "other"; });
      if (!Object.keys(types).length) {
      const sys = `Classify each domain against this business: ${SCAN.ai.biz.slice(0, 70)}. direct = same kind of business competing for the same customers; directory = listings, reviews or lead-gen; media = news, info, wiki, video or forum; other. Reply ONLY JSON {"t":{"id":"direct|directory|media|other"}}`.slice(0, 500);
      const groups = packLines(top, (d, i) => `${i} ${d}`);
      for (const g of groups) {
        const j = await ai(withNote(sys), g.map((d, i) => `${i + 1} ${d}`).join("\n"), "AI: vet competitors");
        Object.entries(j?.t || {}).forEach(([n, t]) => { const d = g[+n - 1]; if (d) types[d] = ["direct", "directory", "media", "other"].includes(t) ? t : "other"; });
      }
      }
      SCAN.ai.types = types;
      R = compute(SCAN);
      const nd = top.filter(d => types[d] === "direct").length;
      log(`✓ AI vetted ${top.length} competitors · ${nd} direct, ${top.length - nd} directories, media or other`, "ok");
    }
    log(`✓ market: ${fmt(R.market.clicks)} organic visits/mo across ${fmt(R.items.length)} searches`, "ok");
    log(`✓ you get ${fmt(R.you.clicks)} visits/mo · competitors take ${fmt(R.missing.clicks)}`, "ok");
    log(`✓ ${fmt(R.notYours.n)} searches where you're not on page one · worth ${fmt(R.notYours.clicks)} visits/mo`, "w");
    await VIZ.gap();
  },
  async proj() {
    const sc = scenarios(R).exp, lead = R.comps.find(c => c.type === "direct") || R.comps[0];
    VIZ.proj(sc);
    if (SCAN.ai && SCAN.ai.biz) {
      const sys = 'You are an SEO strategist talking to a business owner. Use only the numbers given. Plain words, no jargon. Reply ONLY JSON {"takeaway":"2 short sentences max","moves":["3 short actions, 12 words max each"]}';
      const topT = R.topics.filter(t => t.pot > 0).sort((a, b) => b.pot - a.pot).slice(0, 3).map(t => `${t.name} +${Math.round(t.pot)}`).join("; ");
      const u = `site ${SCAN.domain} (${SCAN.ai.biz}); visits now ${Math.round(R.you.clicks)}/mo; market ${Math.round(R.market.clicks)}/mo; competitors take ${Math.round(R.missing.clicks)}/mo; leader ${lead ? lead.d + " ~" + Math.round(lead.clicks) : "n/a"}; 12-month realistic gain +${Math.round(sc.gain)}/mo; biggest gaps: ${topT}; ${R.items.filter(x => x.p > 3 && x.p <= 20).length} searches ranked 4-20`.slice(0, 500);
      let j = await aiTask("summary", { site: SCAN.domain, business: SCAN.ai.biz, location: SCAN.location.label, visits_now: Math.round(R.you.clicks), market_visits: Math.round(R.market.clicks), going_to_competitors: Math.round(R.missing.clicks), leader: lead ? { domain: lead.d, visits: Math.round(lead.clicks) } : null, realistic_12_month_gain: Math.round(sc.gain), full_potential_gain: Math.round(R.table.clicks), biggest_gaps: R.topics.filter(t => t.pot > 0).sort((a, b) => b.pot - a.pot).slice(0, 5).map(t => ({ topic: t.name, visits_open: Math.round(t.pot), leader: t.lead ? t.lead.d : null })), searches_ranked_4_to_20: R.items.filter(x => x.p > 3 && x.p <= 20).length, searches_not_on_page_one: R.notYours.n }, "Claude: write the takeaway");
      if (!j) j = await ai(withNote(sys), u, "AI: write the takeaway");
      if (j) { SCAN.ai.takeaway = String(j.takeaway || "").slice(0, 300); SCAN.ai.moves = (Array.isArray(j.moves) ? j.moves : []).slice(0, 3).map(m => String(m).slice(0, 120)); }
    }
    log(`✓ 12-month projection (expected): ${fmt(R.you.clicks)} → ${fmt(sc.months[12].clicks)} visits/mo`, "ok");
    await sleep(REPLAY ? 300 : 1200);
  },
};

/* ---------- metrics ---------- */
const PACK = [.16, .11, .08], PACK_SUM = .35, ORG_LP = .65;
function compute(S) {
  const U = S.universe, rk = {}; S.ranked.forEach(r => { rk[r.k] = r.p; const g = "s|" + sig(r.k); if (!rk[g] || r.p < rk[g]) rk[g] = r.p; });
  const serpBy = {}; (S.serps || []).forEach(s => serpBy[s.i] = s);
  const local = !!(S.location.region && S.serps && S.serps.length);
  const mineD = d => d === S.domain || d.endsWith("." + S.domain);
  const yourPos = U.map((u, i) => {
    if (serpBy[i]) return serpBy[i].you || null;
    const a = [u.k, ...(u.alt || [])].reduce((m, k) => { const q = rk[k] || rk["s|" + sig(k)]; return q && (!m || q < m) ? q : m; }, null), b = S.youPos?.[i];
    return a && b ? Math.min(a, b) : (a || b || null);
  });
  // competitors: national (Labs) or local (live SERPs incl. map pack)
  let comps;
  if (local) {
    const m = {};
    S.serps.forEach(s => {
      s.org.forEach(([d, r]) => { if (!d || mineD(d)) return; const o = m[d] || (m[d] = { d, pos: {}, pack: {} }); if (!o.pos[s.i] || r < o.pos[s.i]) o.pos[s.i] = r; });
      s.lp.forEach(([t, d], j) => { if (!d || mineD(d)) return; const o = m[d] || (m[d] = { d, pos: {}, pack: {} }); o.pack[s.i] = j + 1; o.name = o.name || t; });
    });
    comps = Object.values(m);
  } else comps = S.comps.map(c => ({ d: c.d, pos: { ...c.pos }, pack: {} }));
  const types = (S.ai && S.ai.types) || {};
  comps.forEach(c => { c.platform = isPlatform(c.d); c.type = types[c.d] || (c.platform ? "directory" : null); });
  let mClicks = 0, mValue = 0, yClicks = 0, yValue = 0, tClicks = 0, tValue = 0, searches = 0, bClicks = 0, bValue = 0, yb = 0, ybv = 0;
  const items = U.map((u, i) => {
    const p = yourPos[i], c = u.c || 0, s = serpBy[i], lp = s && s.lp.length;
    const f = lp ? ORG_LP : 1;
    const pk = s ? (s.lp.findIndex(l => mineD(l[1])) + 1) || null : null;
    const now = u.v * (ctr(p) * f + (pk ? PACK[pk - 1] : 0));
    const mk = u.v * (SUM10 * f + (lp ? PACK_SUM : 0));
    const target = u.v * (TOP3 * f + (lp ? PACK_SUM / 3 : 0));
    const pot = Math.max(0, target - now);
    let lead = null;
    if (s) { if (s.org[0]) lead = { d: s.org[0][0], p: s.org[0][1], me: mineD(s.org[0][0]) }; else if (s.lp[0]) lead = { d: s.lp[0][1] || s.lp[0][0], p: 1, map: true }; }
    else { comps.forEach(cp => { const q = cp.pos[i]; if (q && (!lead || q < lead.p)) lead = { d: cp.d, p: q }; }); if (p && (!lead || p < lead.p)) lead = { d: S.domain, p, me: true }; if (lead && lead.p > 10) lead = null; }
    searches += u.v; mClicks += mk; mValue += mk * c; yClicks += now; yValue += now * c; tClicks += pot; tValue += pot * c;
    if (!local || s) { bClicks += mk; bValue += mk * c; yb += now; ybv += now * c; }
    return { ...u, i, p, pk, f, live: !!s, lp: !!lp, st: pk ? "top" : status(p), now, nowVal: now * c, mk, mkVal: mk * c, pot, potVal: pot * c, lead };
  });
  comps.forEach(cp => {
    let cl = 0, val = 0, n = 0, n3 = 0, sp = 0, np = 0, own = 0, ownC = 0;
    const idx = new Set([...Object.keys(cp.pos), ...Object.keys(cp.pack)]);
    idx.forEach(i => {
      const u = U[i], it = items[i]; if (!u) return;
      const p = cp.pos[i], k = cp.pack[i];
      const x = u.v * ((p ? ctr(p) * it.f : 0) + (k ? PACK[k - 1] : 0)); cl += x; val += x * (u.c || 0);
      if (p && p <= 10) { n++; sp += p; } if (p && p <= 3) n3++; if (k) np++;
      if (((p && p <= 10) || k) && !(it.p && it.p <= 10) && !it.pk) { own++; ownC += x; }
    });
    Object.assign(cp, { own, ownClicks: ownC, clicks: cl, value: val, kw10: n, kw3: n3, packs: np, avg: n ? sp / n : null, share: bClicks ? cl / bClicks : 0 });
  });
  comps.sort((a, b) => b.clicks - a.clicks);
  const you = { d: S.domain, clicks: yClicks, value: yValue, bClicks: yb, share: bClicks ? yb / bClicks : 0, kw10: items.filter(x => x.p && x.p <= 10).length, kw3: items.filter(x => x.p && x.p <= 3).length, packs: items.filter(x => x.pk).length, me: true };
  you.rank = comps.filter(c => c.clicks > yb).length + 1;
  if (yb <= 0) you.rank = comps.length + 1;
  const ps = items.filter(x => x.p && x.p <= 10); you.avg = ps.length ? ps.reduce((a, x) => a + x.p, 0) / ps.length : null;
  const topics = clusterTopics(items, S, comps);
  const rest = Math.max(0, bClicks - yb - comps.slice(0, 5).reduce((a, c) => a + c.clicks, 0));
  const nLive = local ? S.serps.length : 0;
  const basis = local ? { local: true, clicks: bClicks, value: bValue, n: nLive, pct: mValue ? bValue / mValue : (mClicks ? bClicks / mClicks : 0), where: S.location.city || S.location.region } : { local: false, clicks: mClicks, value: mValue, n: items.length, pct: 1 };
  const ny = items.filter(x => !(x.p && x.p <= 10) && !x.pk);
  const notYours = { n: ny.length, clicks: ny.reduce((a, x) => a + x.mk - x.now, 0), value: ny.reduce((a, x) => a + x.mkVal - x.nowVal, 0) };
  return { items, comps, you, topics, searches, basis, notYours, missing: { clicks: Math.max(0, mClicks - yClicks), value: Math.max(0, mValue - yValue) }, market: { clicks: mClicks, value: mValue }, table: { clicks: tClicks, value: tValue }, rest };
}

function clusterTopics(items, S, comps) {
  const seedT = new Set(S.seeds.flatMap(toks));
  const domT = new Set(toks(S.domain.split(".")[0]));
  const keep = t => t.length > 1 && (!GENERIC.has(t) || TOPIC_OK.has(t)) && !seedT.has(t) && !GEO_TOKENS.has(t) && !domT.has(t) && !/^\d+$/.test(t);
  const w = x => x.mkVal > 0 ? x.mkVal : x.mk * 0.5;
  const uni = {}, bi = {}, cnt = {};
  const kt = items.map(x => {
    const t = toks(x.k), f = t.filter(keep), bs = [];
    for (let j = 0; j < t.length - 1; j++) if (keep(t[j]) && keep(t[j + 1])) bs.push(t[j] + " " + t[j + 1]);
    new Set(f).forEach(a => { uni[a] = (uni[a] || 0) + w(x); cnt[a] = (cnt[a] || 0) + 1; });
    new Set(bs).forEach(b => { bi[b] = (bi[b] || 0) + w(x); });
    return { f: new Set(f), b: new Set(bs) };
  });
  const assigned = new Array(items.length).fill(-1), topics = [];
  const total = items.reduce((a, x) => a + w(x), 0) || 1;
  const stRe = S.location.region ? new RegExp("(^|\\s)(" + [S.location.region.toLowerCase(), S.location.abbr.toLowerCase(), "county", "township"].join("|") + ")($|\\s)") : null;
  const BUCKETS = [
    ["costs & fees", k => /\b(cost|costs|fee|fees|price|prices|percentage|percent|charge|charges|contingency|how much|settlement|settlements|calculator|worth|payout)\b/.test(k)],
    ["questions", k => /^(how|what|when|where|why|who|which|can|do|does|is|should|are|will)\b/.test(k)],
    ["free consultation", k => /\b(free|consultation|consult)\b/.test(k)],
    ["near me", k => /\bnear( me|by)?\b/.test(k)],
    ["best & top rated", k => /\b(best|top|rated|review|reviews|recommended|highest|leading|award)\b/.test(k)],
    ["firms & offices", k => /\b(firm|firms|office|offices|associates|practice)\b/.test(k)],
    ["towns & counties", (k, i) => stRe && (stRe.test(k) || /\bcounty\b/.test(k)) && kt[i].f.size > 0 && ![...kt[i].f].every(t => uni[t] > total * 0.02)],
    ["cities & towns", (k, i) => !!S.location.region && kt[i].f.size > 0 && items[i].nv > 0 && !items[i].ve && items[i].v / items[i].nv >= 0.5],
  ];
  // after the named groups, also split what's left by its most common modifiers
  BUCKETS.forEach(([name, test]) => {
    const idx = []; items.forEach((x, i) => { if (assigned[i] < 0 && test(x.k, i)) idx.push(i); });
    if (idx.length >= 3) { const ti = topics.length; topics.push({ name, idx }); idx.forEach(i => assigned[i] = ti); }
  });
  for (let round = 0; round < 16 && topics.length < 15; round++) {
    const sc = {}; const add = (lab, x, i, isBi) => { if (assigned[i] >= 0) return; sc[lab] = sc[lab] || { lab, w: 0, n: 0, bi: isBi }; sc[lab].w += w(x); sc[lab].n++; };
    items.forEach((x, i) => { kt[i].f.forEach(a => add(a, x, i, false)); kt[i].b.forEach(b => add(b, x, i, true)); });
    let cand = Object.values(sc).filter(c => c.n >= 3).sort((a, b) => b.w - a.w);
    if (!cand.length) break;
    let best = cand[0];
    if (!best.bi) { const b = cand.find(c => c.bi && c.lab.split(" ").includes(best.lab) && c.w >= best.w * 0.6); if (b) best = b; }
    if (best.w / total < 0.0015 && best.n < 5) break;
    const ti = topics.length; topics.push({ name: best.lab, idx: [] });
    items.forEach((x, i) => { if (assigned[i] < 0 && (best.bi ? kt[i].b.has(best.lab) : kt[i].f.has(best.lab))) { assigned[i] = ti; topics[ti].idx.push(i); } });
  }
  const restName = S.seeds.length ? S.seeds[0] : "other searches";
  const rest = { name: restName, idx: [], core: true };
  items.forEach((x, i) => { if (assigned[i] < 0) { rest.idx.push(i); assigned[i] = topics.length; } });
  if (rest.idx.length) topics.push(rest);
  topics.forEach(t => {
    const xs = t.idx.map(i => items[i]);
    t.searches = xs.reduce((a, x) => a + x.v, 0); t.value = xs.reduce((a, x) => a + x.mkVal, 0); t.clicks = xs.reduce((a, x) => a + x.mk, 0);
    t.yours = xs.reduce((a, x) => a + x.now, 0); t.yourVal = xs.reduce((a, x) => a + x.nowVal, 0);
    t.pot = xs.reduce((a, x) => a + x.pot, 0); t.potVal = xs.reduce((a, x) => a + x.potVal, 0);
    t.n = xs.length;
    let lead = null;
    comps.forEach(c => { let cl = 0; t.idx.forEach(i => { const p = c.pos[i], k = c.pack && c.pack[i]; if (p) cl += items[i].v * ctr(p) * items[i].f; if (k) cl += items[i].v * PACK[k - 1]; }); if (!lead || cl > lead.clicks) lead = { d: c.d, clicks: cl }; });
    t.lead = lead && lead.clicks > 0 ? lead : null;
    t.share = t.clicks ? t.yours / t.clicks : 0; t.leadShare = t.lead && t.clicks ? t.lead.clicks / t.clicks : 0;
    xs.forEach(x => x.topic = t.name);
  });
  topics.sort((a, b) => (b.potVal || b.pot) - (a.potVal || a.pot));
  return topics;
}

/* ---------- scan overlay visual ---------- */
const VIZ = (() => {
  let cv, ctx, W, H, D, CX, CY, RAD, raf, mob, P;
  let parts = [], byK = {}, comps = [], beams = [], tiles = [], labels = [], wedges = null, center = "", sweep = 0;
  let scene = null, phase = 0, projFrac = 0, aiCore = 0, tokens = [], probes = [], rows = [], rowsAt = 0, gapList = [], bars = [];
  const C = { gold: "#ffc13b", green: "#3ee98a", cyan: "#2fd0ff", pink: "#ff4fa8", violet: "#9b8cff", orange: "#ff8a3d", red: "#ff5d6c", ink: "#f3f4ff", ink2: "#b3b7e0", ink3: "#7a7fae", line: "#2a2e58", panel: "rgba(17,19,42,.9)" };
  const TYPE_C = { direct: C.red, directory: C.orange, media: C.cyan, other: C.ink3 };
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const now = () => performance.now();
  const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  function resize() {
    D = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * D; cv.height = H * D; ctx.setTransform(D, 0, 0, D, 0, 0);
    mob = W < 1000;
    if (!mob) { P = { x: 28, y: 172, w: Math.min(360, W * 0.27), h: H - 172 - 190 }; const left = P.x + P.w + 34, right = W - 462; CX = (left + right) / 2; CY = H * 0.5; RAD = Math.min((right - left) / 2 / 1.5, H * 0.33); }
    else { RAD = Math.min(W * 0.34, H * 0.17); CY = 118 + RAD + 22; CX = W / 2; const py = CY + RAD + 30; P = { x: 14, y: py, w: W - 28, h: Math.max(110, H - 212 - py) }; }
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function txt(s, x, y, font, col, align = "left") { ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align; ctx.fillText(s, x, y); }
  function fit(s, maxW) { if (ctx.measureText(s).width <= maxW) return s; while (s.length > 3 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1); return s + "…"; }
  const DISP = '"Unbounded","Arial Black",sans-serif', MONO = '"JetBrains Mono",monospace', BODY = '"Instrument Sans",Arial,sans-serif';
  function panelBox(title, accent, t0) {
    const a = ease((now() - t0) / 400);
    ctx.globalAlpha = a; rr(P.x, P.y, P.w, P.h, 14); ctx.fillStyle = C.panel; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = accent; ctx.fillRect(P.x + 16, P.y + 17, 7, 7);
    txt(title, P.x + 30, P.y + 24, `700 ${mob ? 10 : 11}px ${MONO}`, accent);
    return a;
  }
  function topicKey(k) { const f = toks(k).filter(t => !GENERIC.has(t) && !GEO_TOKENS.has(t) && !((SCAN.seeds || []).join(" ").includes(t))); return f[0] || k; }
  function place(k, inner, w) {
    const a = w ? w[0] + w[1] * (0.08 + 0.84 * hash(k + "a")) : hash(topicKey(k)) * Math.PI * 2 + (hash(k) - 0.5) * 0.5;
    const r = inner ? 0.1 + 0.28 * hash(k + "r") : 0.42 + 0.58 * Math.sqrt(hash(k + "r"));
    return { tx: CX + Math.cos(a) * r * RAD * 1.25, ty: CY + Math.sin(a) * r * RAD };
  }
  function sizeOf(v) { return 1.3 + Math.min(6.5, Math.sqrt(v / 60)); }
  function addPart(k, v, inner, mine, st, from) {
    if (byK[k]) return byK[k];
    const pl = place(k, inner); const ang = Math.random() * 7;
    const p = { k, v, inner, x: from ? from.x : CX + Math.cos(ang) * RAD * 2, y: from ? from.y : CY + Math.sin(ang) * RAD * 2, ...pl, r: 0, tr: sizeOf(v), mine, st, ph: Math.random() * 6, a: 1, gone: 0, vy: 0 };
    parts.push(p); byK[k] = p; return p;
  }
  function setTopics() {
    const items = SCAN.universe.map((u, i) => ({ ...u, i, mk: u.v * SUM10, mkVal: u.v * SUM10 * (u.c || 0) }));
    const tp = clusterTopics(items, SCAN, []).slice(0, 10);
    const tot = tp.reduce((a, t) => a + Math.max(t.n, 6), 0) || 1;
    let a0 = -Math.PI / 2; wedges = {}; labels = [];
    tp.forEach((t, j) => { const span = Math.PI * 2 * Math.max(t.n, 6) / tot; wedges[t.name] = [a0, span]; labels.push({ name: t.name, a: a0 + span / 2, n: t.n, born: now() + j * 140 }); a0 += span; });
    const tk = {}; items.forEach(x => tk[x.k] = x.topic);
    parts.forEach(p => { const w = wedges[tk[p.k]]; if (!w) return; const pl = place(p.k, p.inner, w); p.tx = pl.tx; p.ty = pl.ty; });
  }
  function start(domain) {
    cv = $("#radar"); ctx = cv.getContext("2d"); resize(); window.addEventListener("resize", resize);
    parts = []; byK = {}; comps = []; beams = []; tiles = []; labels = []; wedges = null; tokens = []; probes = []; rows = []; gapList = []; bars = [];
    center = domain; phase = 0; projFrac = 0; aiCore = 0; scene = null;
    cancelAnimationFrame(raf); loop();
  }
  function stop() { cancelAnimationFrame(raf); }
  function loop() {
    const t = now();
    ctx.clearRect(0, 0, W, H);
    // radar rings + sweep
    ctx.strokeStyle = "rgba(155,140,255,.13)"; ctx.lineWidth = 1;
    [0.4, 0.7, 1].forEach(k => { ctx.beginPath(); ctx.ellipse(CX, CY, RAD * k * 1.25, RAD * k, 0, 0, 7); ctx.stroke(); });
    sweep += 0.016;
    if (ctx.createConicGradient) { const g = ctx.createConicGradient(sweep, CX, CY); g.addColorStop(0, aiCore ? "rgba(155,140,255,.22)" : "rgba(255,193,59,.17)"); g.addColorStop(0.08, "rgba(255,193,59,0)"); g.addColorStop(1, "rgba(255,193,59,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(CX, CY, RAD * 1.25, RAD, 0, 0, 7); ctx.fill(); }
    // probes (market)
    probes.forEach(pr => { const k = ((t - pr.t) / 900) % 1; const x1 = CX + Math.cos(pr.a) * RAD * 1.25, y1 = CY + Math.sin(pr.a) * RAD; ctx.strokeStyle = `rgba(47,208,255,${0.25 + 0.25 * Math.sin(t / 200 + pr.a)})`; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(CX + (x1 - CX) * k, CY + (y1 - CY) * k, 2.5, 0, 7); ctx.fill(); });
    // beams competitor -> keyword
    beams = beams.filter(b => t - b.t < 1400);
    beams.forEach(b => { const a = 1 - (t - b.t) / 1400; ctx.strokeStyle = phase ? `rgba(255,193,59,${0.45 * a})` : `rgba(255,93,108,${0.35 * a})`; ctx.beginPath(); ctx.moveTo(b.a.x, b.a.y); ctx.lineTo(b.b.x, b.b.y); ctx.stroke(); });
    if (comps.length && Math.random() < (phase === 1 ? 0.9 : 0.45)) { const c = comps[Math.floor(Math.random() * comps.length)]; if (c.own.length) beams.push({ a: c, b: c.own[Math.floor(Math.random() * c.own.length)], t }); }
    // particles
    parts.forEach(p => {
      if (p.gone) { p.vy += 0.18; p.y += p.vy; p.a = Math.max(0, p.a - 0.012); }
      else { p.x += (p.tx - p.x) * 0.06; p.y += (p.ty - p.y) * 0.06; }
      p.r += (p.tr - p.r) * 0.08;
      if (p.a <= 0) return;
      let col = p.mine ? (COLORS[p.st] || C.green) : "rgba(150,155,210,.42)";
      if (phase >= 1 && !p.mine) col = p.won ? C.green : `rgba(255,193,59,${0.4 + 0.35 * Math.sin(t / 300 + p.ph)})`;
      if (p.keep && t - p.keep < 700) col = C.green;
      if (p.gone) col = C.red;
      ctx.globalAlpha = p.a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.6, p.r), 0, 7); ctx.fill();
      if (p.ping && t - p.ping < 900) { const a = 1 - (t - p.ping) / 900; ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 14 * (1 - a) + 2, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
    // AI core + tokens flowing in
    if (aiCore) {
      const pul = 1 + 0.08 * Math.sin(t / 220);
      const gr = ctx.createRadialGradient(CX, CY, 0, CX, CY, 60 * pul); gr.addColorStop(0, "rgba(155,140,255,.55)"); gr.addColorStop(1, "rgba(155,140,255,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(CX, CY, 60 * pul, 0, 7); ctx.fill();
      ctx.strokeStyle = C.violet; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -t / 40; ctx.beginPath(); ctx.arc(CX, CY, 30, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.fillStyle = "#1a1640"; ctx.beginPath(); ctx.arc(CX, CY, 22, 0, 7); ctx.fill(); ctx.strokeStyle = C.violet; ctx.stroke();
      txt("AI", CX, CY + 5, `800 14px ${DISP}`, C.ink, "center");
    }
    tokens = tokens.filter(k => t - k.t < 2400);
    tokens.forEach(k => { const q = ease((t - k.t) / 2000); if (q <= 0) return; const x = k.x + (CX - k.x) * q, y = k.y + (CY - k.y) * q; ctx.globalAlpha = 1 - q * q; txt(k.s, x, y, `600 ${mob ? 10 : 12}px ${MONO}`, C.ink2, "center"); ctx.globalAlpha = 1; });
    if (aiCore && Math.random() < 0.06 && scene && scene.toks && scene.toks.length) { const s = scene.toks[Math.floor(Math.random() * scene.toks.length)]; const a = Math.random() * 7; tokens.push({ s, x: CX + Math.cos(a) * RAD * 1.5, y: CY + Math.sin(a) * RAD * 1.15, t }); }
    // competitor planets
    comps.forEach(c => {
      c.a += 0.0008; c.x = CX + Math.cos(c.a) * RAD * 1.36; c.y = CY + Math.sin(c.a) * RAD * 1.1;
      const col = c.type ? TYPE_C[c.type] : C.red;
      ctx.fillStyle = col + "2e"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 10, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill();
      ctx.font = `600 ${mob ? 9 : 11}px ${MONO}`; const nm = fit(c.d, mob ? 92 : 150);
      txt(nm, c.x, c.y - c.r - 8, ctx.font, C.ink2, "center");
      if (c.type && c.typeAt) { const a = ease((t - c.typeAt) / 500); ctx.globalAlpha = a; txt(c.type.toUpperCase(), c.x, c.y + c.r + 14, `700 ${mob ? 8 : 9}px ${MONO}`, col, "center"); ctx.globalAlpha = 1; }
    });
    // topic titles around the radar
    labels.forEach(l => {
      if (mob && comps.length) return;
      const a = Math.min(1, Math.max(0, (t - l.born) / 600)); if (!a) return;
      ctx.globalAlpha = a; const lx = CX + Math.cos(l.a) * RAD * 1.25 * 1.07, ly = CY + Math.sin(l.a) * RAD * 1.07;
      const s = l.name.toUpperCase(); ctx.font = `700 ${mob ? 8.5 : 10.5}px ${MONO}`; const al = Math.cos(l.a) > 0.25 ? "left" : Math.cos(l.a) < -0.25 ? "right" : "center";
      const tw = ctx.measureText(s).width, bx = al === "left" ? lx - 5 : al === "right" ? lx - tw - 5 : lx - tw / 2 - 5;
      ctx.fillStyle = "rgba(10,11,25,.85)"; ctx.fillRect(bx, ly - 10, tw + 10, 15); txt(s, lx, ly + 1.5, ctx.font, "#ffd56e", al); ctx.globalAlpha = 1;
    });
    // center node
    if (!aiCore) {
      ctx.fillStyle = "rgba(62,233,138,.16)"; ctx.beginPath(); ctx.arc(CX, CY, 24 + 4 * Math.sin(t / 400), 0, 7); ctx.fill();
      ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(CX, CY, 8, 0, 7); ctx.fill();
    }
    txt(center, CX, CY + 46, `700 ${mob ? 12 : 14}px ${BODY}`, C.ink, "center");
    // scene panel
    if (scene && DRAW[scene.id]) DRAW[scene.id](t);
    raf = requestAnimationFrame(loop);
  }
  /* ----- panels per scene ----- */
  const DRAW = {
    foot(t) {
      const o = SCAN.overview || {}, a = panelBox("YOUR FOOTPRINT", C.green, scene.t0), k = ease((t - scene.t0 - 300) / 1400);
      const top = P.y + 40;
      txt(fmt((o.count || 0) * k), P.x + 16, top + (mob ? 26 : 36), `800 ${mob ? 24 : 34}px ${DISP}`, C.ink);
      txt("keywords ranking · ~" + fmt((o.etv || 0) * k) + " visits/mo", P.x + 16, top + (mob ? 44 : 58), `500 ${mob ? 11 : 13}px ${BODY}`, C.ink2);
      const rowsF = [["Top 3", o.top3 || 0, C.green], ["4–10", o.p10 || 0, C.cyan], ["11–20", o.p20 || 0, C.gold], ["21–100", Math.max(0, (o.count || 0) - (o.top3 || 0) - (o.p10 || 0) - (o.p20 || 0)), C.violet]];
      const mx = Math.max(1, ...rowsF.map(r => r[1])), y0 = top + (mob ? 60 : 84), rh = mob ? Math.min(22, (P.h - 110) / 4) : 30;
      rowsF.forEach(([l, n, c], j) => { const y = y0 + j * rh, q = ease((t - scene.t0 - 600 - j * 220) / 900), bw = (P.w - 130) * n / mx * q;
        txt(l, P.x + 16, y + 11, `600 ${mob ? 10 : 11}px ${MONO}`, C.ink3); rr(P.x + 74, y, P.w - 130, 12, 4); ctx.fillStyle = "#0d0f24"; ctx.fill(); if (bw > 1) { rr(P.x + 74, y, bw, 12, 4); ctx.fillStyle = c; ctx.fill(); } txt(fmt(n * q), P.x + P.w - 16, y + 11, `700 ${mob ? 10 : 12}px ${MONO}`, C.ink, "right"); });
      ctx.globalAlpha = 1;
    },
    brain(t) {
      panelBox("AI · READING THE BUSINESS", C.violet, scene.t0);
      const y = P.y + 44;
      if (!scene.biz) { const dots = ".".repeat(1 + Math.floor(t / 350) % 3); txt("thinking" + dots, P.x + 16, y + 10, `600 ${mob ? 12 : 14}px ${MONO}`, C.violet); txt(`reading ${scene.toks.length} top searches`, P.x + 16, y + 30, `500 12px ${BODY}`, C.ink3); ctx.globalAlpha = 1; return; }
      const n = Math.floor(Math.min(scene.biz.length, (t - scene.bizAt) / 28));
      ctx.font = `700 ${mob ? 13 : 15}px ${BODY}`; wrapText(scene.biz.slice(0, n), P.x + 16, y + 10, P.w - 32, mob ? 17 : 20, C.ink);
      const sy = y + (mob ? 44 : 62);
      txt("SERVICES TO MAP", P.x + 16, sy, `700 ${mob ? 9 : 10}px ${MONO}`, C.ink3);
      let x = P.x + 16, yy = sy + 10; ctx.font = `600 ${mob ? 11 : 12}px ${BODY}`;
      (scene.svc || []).forEach((s, j) => { const q = ease((t - scene.bizAt - 900 - j * 260) / 400); if (q <= 0) return; const w = ctx.measureText(s).width + 18; if (x + w > P.x + P.w - 12) { x = P.x + 16; yy += mob ? 24 : 28; } if (yy + 22 > P.y + P.h) return; ctx.globalAlpha = q; rr(x, yy, w, mob ? 20 : 22, 11); ctx.fillStyle = "rgba(155,140,255,.16)"; ctx.fill(); ctx.strokeStyle = C.violet; ctx.stroke(); txt(s, x + 9, yy + (mob ? 14 : 15), ctx.font, C.ink); x += w + 6; ctx.globalAlpha = 1; });
    },
    market(t) {
      panelBox("MAPPING THE MARKET", C.cyan, scene.t0);
      const sd = scene.seeds || [], cnt = SCAN.seedCounts || {}, mx = Math.max(1, ...sd.map(s => cnt[s] || 0)), rh = mob ? Math.min(22, (P.h - 50) / Math.max(1, sd.length)) : Math.min(36, (P.h - 70) / Math.max(1, sd.length));
      sd.forEach((s, j) => { const y = P.y + 46 + j * rh; ctx.font = `600 ${mob ? 11 : 12.5}px ${BODY}`; txt(fit(s, P.w - 110), P.x + 16, y + 10, ctx.font, C.ink);
        const has = cnt[s] != null, q = has ? ease((t - scene.doneAt - j * 150) / 900) : 0;
        if (!mob) { rr(P.x + 16, y + 16, P.w - 32, 6, 3); ctx.fillStyle = "#0d0f24"; ctx.fill(); }
        if (has) { if (!mob) { rr(P.x + 16, y + 16, (P.w - 32) * (cnt[s] / mx) * q, 6, 3); ctx.fillStyle = C.cyan; ctx.fill(); } txt(fmt(cnt[s] * q), P.x + P.w - 16, y + 10, `700 ${mob ? 11 : 12}px ${MONO}`, C.cyan, "right"); }
        else { const sh = (t / 6 + j * 40) % (P.w - 32); if (!mob) { ctx.fillStyle = "rgba(47,208,255,.5)"; ctx.fillRect(P.x + 16 + sh, y + 16, 30, 6); } txt("…", P.x + P.w - 16, y + 10, `700 12px ${MONO}`, C.cyan, "right"); } });
    },
    filter(t) {
      panelBox("AI · RELEVANCE CHECK", C.violet, scene.t0);
      const kept = rows.filter(r => r.st === true).length, drop = rows.filter(r => r.st === false).length;
      txt(`✓ ${fmt(kept)} kept`, P.x + 16, P.y + 46, `700 ${mob ? 11 : 13}px ${MONO}`, C.green); txt(`✗ ${fmt(drop)} dropped`, P.x + (mob ? 120 : 140), P.y + 46, `700 ${mob ? 11 : 13}px ${MONO}`, C.red);
      const marked = rows.filter(r => r.st != null), rh = mob ? 17 : 21, maxR = Math.floor((P.h - 70) / rh);
      const vis = marked.slice(-maxR), y0 = P.y + 62;
      ctx.save(); ctx.beginPath(); ctx.rect(P.x, y0 - 4, P.w, P.h - (y0 - P.y)); ctx.clip();
      vis.forEach((r, j) => { const y = y0 + j * rh, q = ease((t - r.at) / 350); ctx.globalAlpha = Math.max(.25, q);
        txt(r.st ? "✓" : "✗", P.x + 16, y + 12, `700 12px ${MONO}`, r.st ? C.green : C.red);
        ctx.font = `500 ${mob ? 11 : 12.5}px ${BODY}`; const s = fit(r.k, P.w - (r.st ? 50 : 110)); txt(s, P.x + 34, y + 12, ctx.font, r.st ? C.ink : C.ink3);
        if (!r.st) { const w = ctx.measureText(s).width; ctx.strokeStyle = "rgba(255,93,108,.7)"; ctx.beginPath(); ctx.moveTo(P.x + 34, y + 8); ctx.lineTo(P.x + 34 + w * q, y + 8); ctx.stroke();
          const lab = { geo: "location", job: "jobs", brand: "brand", off: "off-topic" }[r.why] || r.why; ctx.font = `700 9px ${MONO}`; const lw = ctx.measureText(lab).width + 10; rr(P.x + P.w - 16 - lw, y + 1, lw, 15, 7); ctx.fillStyle = "rgba(255,93,108,.15)"; ctx.fill(); txt(lab, P.x + P.w - 21, y + 12, ctx.font, C.red, "right"); }
        ctx.globalAlpha = 1; });
      ctx.restore();
      // scan line
      const sy = y0 + Math.min(vis.length, maxR) * rh - 2; ctx.strokeStyle = "rgba(155,140,255,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x + 10, sy); ctx.lineTo(P.x + P.w - 10, sy); ctx.stroke(); ctx.lineWidth = 1;
    },
    local(t) {
      panelBox("LOCAL DEMAND · " + (SCAN.location.abbr || ""), C.gold, scene.t0);
      const lt = SCAN.localTotals || { nat: SCAN.universe.reduce((a, u) => a + (u.nv || u.v), 0), loc: SCAN.universe.reduce((a, u) => a + u.v, 0) };
      const q = ease((t - scene.t0 - 300) / 1400), pct = lt.nat ? lt.loc / lt.nat : 0;
      txt((pct * 100 * q).toFixed(1) + "%", P.x + 16, P.y + (mob ? 72 : 86), `800 ${mob ? 26 : 36}px ${DISP}`, C.gold);
      txt(`of US searches for this market happen in ${SCAN.location.region}`, P.x + 16, P.y + (mob ? 90 : 110), `500 ${mob ? 11 : 13}px ${BODY}`, C.ink2);
      [["Nationwide", lt.nat, C.ink3], [SCAN.location.region, lt.loc, C.gold]].forEach(([l, v, c], j) => { const y = P.y + (mob ? 104 : 136) + j * (mob ? 22 : 30); txt(l, P.x + 16, y + 10, `600 11px ${MONO}`, C.ink3); const bw = (P.w - 150) * (v / Math.max(1, lt.nat)) * q; rr(P.x + 100, y, Math.max(2, bw), 12, 4); ctx.fillStyle = c; ctx.fill(); txt(fmt(v * q) + "/mo", P.x + P.w - 16, y + 11, `700 11px ${MONO}`, C.ink, "right"); });
    },
    comp(t) {
      panelBox("WHO OWNS THE MARKET", C.red, scene.t0);
      const list = scene.list || [], mx = Math.max(1, ...list.map(r => r.v)), rh = mob ? Math.min(20, (P.h - 50) / Math.max(1, list.length)) : Math.min(40, (P.h - 60) / Math.max(1, list.length));
      list.forEach((r, j) => { const y = P.y + 44 + j * rh, q = ease((t - scene.t0 - 400 - j * 160) / 1100);
        ctx.font = `${r.me ? 800 : 600} ${mob ? 10.5 : 12}px ${BODY}`; txt(fit(r.d, mob ? P.w * 0.42 : P.w - 100), P.x + 16, y + 11, ctx.font, r.me ? C.green : C.ink);
        const bx = mob ? P.x + P.w * 0.47 : P.x + 16, by = mob ? y + 3 : y + 17, bwm = mob ? P.w * 0.36 : P.w - 32;
        rr(bx, by, Math.max(2, bwm * (r.v / mx) * q), mob ? 9 : 7, 3); ctx.fillStyle = r.me ? C.green : C.red; ctx.fill();
        txt(fmt(r.v * q), P.x + P.w - 16, y + 11, `700 ${mob ? 10 : 11}px ${MONO}`, C.ink2, "right"); });
      if (!mob) txt("estimated visits / month", P.x + 16, P.y + P.h - 12, `500 11px ${BODY}`, C.ink3);
    },
    serp(t) {
      panelBox("LIVE GOOGLE · " + (SCAN.location.city || ""), C.cyan, scene.t0);
      const cols = mob ? 6 : 4, tw = (P.w - 32 - (cols - 1) * 8) / cols, th = mob ? 74 : 92;
      tiles.slice(0, mob ? 12 : 12).forEach((s, j) => { const cx = P.x + 16 + (j % cols) * (tw + 8), cy = P.y + 40 + Math.floor(j / cols) * (th + 8); if (cy + th > P.y + P.h - 4) return; const a = ease((t - s.t) / 400); ctx.globalAlpha = a;
        rr(cx, cy, tw, th, 6); ctx.fillStyle = "#0d0f24"; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
        ctx.font = `600 ${mob ? 7.5 : 8.5}px ${MONO}`; txt(fit(s.k, tw - 8), cx + 4, cy + 11, ctx.font, C.ink3);
        if (s.lp && s.lp.length) { ctx.fillStyle = "rgba(47,208,255,.5)"; ctx.fillRect(cx + 4, cy + 16, tw - 8, 6); }
        for (let r = 0; r < 8; r++) { const d = s.org[r]; const me = d && (d[0] === SCAN.domain || d[0].endsWith("." + SCAN.domain)); ctx.fillStyle = me ? C.green : r === 0 ? C.red : C.line; ctx.fillRect(cx + 4, cy + 26 + r * ((th - 32) / 8), tw - 8, Math.max(3, (th - 32) / 8 - 3)); }
        ctx.globalAlpha = 1; });
    },
    gap(t) {
      panelBox("TRAFFIC YOU DON'T OWN", C.gold, scene.t0);
      const q = ease((t - scene.t0 - 300) / 1800);
      txt(fmt((R ? R.missing.clicks : 0) * q), P.x + 16, P.y + (mob ? 66 : 80), `800 ${mob ? 26 : 36}px ${DISP}`, C.gold);
      txt("visits/mo going to other sites", P.x + 16, P.y + (mob ? 84 : 102), `500 ${mob ? 11 : 13}px ${BODY}`, C.ink2);
      const list = gapList, rh = mob ? 18 : 34, y0 = P.y + (mob ? 98 : 126);
      list.forEach((c, j) => { const y = y0 + j * rh; if (y + rh > P.y + P.h) return; const a = ease((t - scene.t0 - 900 - j * 280) / 500); if (a <= 0) return; ctx.globalAlpha = a;
        ctx.font = `600 ${mob ? 10.5 : 12}px ${BODY}`; txt(fit(c.d, P.w * (mob ? .5 : .62)), P.x + 16, y + 11, ctx.font, C.ink);
        if (c.type) { ctx.font = `700 8.5px ${MONO}`; const lab = c.type.toUpperCase(), lw = ctx.measureText(lab).width + 10, lx = mob ? P.x + P.w * 0.55 : P.x + 16; const ly = mob ? y : y + 16; rr(lx, ly, lw, 14, 7); ctx.fillStyle = TYPE_C[c.type] + "26"; ctx.fill(); txt(lab, lx + 5, ly + 10, ctx.font, TYPE_C[c.type]); }
        txt(`${fmt(c.own)} kw · ${fmt(c.ownClicks)}`, P.x + P.w - 16, y + 11, `700 ${mob ? 10 : 11}px ${MONO}`, C.gold, "right"); ctx.globalAlpha = 1; });
    },
    proj(t) {
      panelBox("NEXT 12 MONTHS · EXPECTED", C.green, scene.t0);
      const sc = scene.sc; if (!sc) return;
      const x0 = P.x + 18, x1 = P.x + P.w - 18, y0 = P.y + P.h - 26, y1 = P.y + (mob ? 58 : 84), mx = Math.max(...sc.months.map(m => m.clicks)) * 1.1 || 1;
      const q = ease((t - scene.t0 - 300) / 3200), upto = q * 12;
      ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      ctx.setLineDash([2, 4]); ctx.strokeStyle = C.green; const by = y0 - (y0 - y1) * (sc.months[0].clicks / mx); ctx.beginPath(); ctx.moveTo(x0, by); ctx.lineTo(x1, by); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.beginPath();
      for (let m = 0; m <= upto; m += 0.25) { const i = Math.floor(m), f = m - i, a = sc.months[i].clicks, b = sc.months[Math.min(12, i + 1)].clicks, v = a + (b - a) * f; const X = x0 + (x1 - x0) * m / 12, Y = y0 - (y0 - y1) * (v / mx); m === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
      ctx.stroke(); ctx.lineWidth = 1;
      const i = Math.floor(upto), cur = sc.months[Math.min(12, i)].clicks;
      txt(fmt(cur), P.x + 16, P.y + (mob ? 50 : 66), `800 ${mob ? 20 : 28}px ${DISP}`, C.gold);
      txt(`visits/mo at month ${Math.min(12, i)} (today ${fmt(sc.months[0].clicks)})`, P.x + (mob ? 110 : 16), P.y + (mob ? 48 : 84 - 2) + (mob ? 0 : 0), `500 ${mob ? 10.5 : 12}px ${BODY}`, C.ink2);
      for (let m = 0; m <= 12; m += 3) txt(m === 0 ? "now" : "m" + m, x0 + (x1 - x0) * m / 12, y0 + 14, `600 9.5px ${MONO}`, C.ink3, "center");
      projFrac = q;
    },
  };
  function wrapText(s, x, y, maxW, lh, col) { const w = s.split(" "); let line = "", yy = y; ctx.fillStyle = col; ctx.textAlign = "left"; w.forEach(word => { const t2 = line ? line + " " + word : word; if (ctx.measureText(t2).width > maxW && line) { ctx.fillText(line, x, yy); line = word; yy += lh; } else line = t2; }); if (line) ctx.fillText(line, x, yy); }
  /* ----- step hooks ----- */
  function foot() {
    scene = { id: "foot", t0: now() };
    SCAN.ranked.slice().sort((a, b) => b.v - a.v).slice(0, 220).forEach((r, j) => setTimeout(() => { const p = addPart(r.k, r.v, true, r.p <= 20, status(r.p), { x: CX, y: CY }); p.ping = now(); }, j * (REPLAY ? 6 / SPEED : 8)));
  }
  function brain(toksList) { aiCore = 1; scene = { id: "brain", t0: now(), toks: (toksList || []).slice(0, 16), biz: null }; }
  function brainDone() { if (!scene || scene.id !== "brain") brain([]); scene.biz = (SCAN.ai && SCAN.ai.biz) || "Business identified from its rankings"; scene.svc = (SCAN.ai && SCAN.ai.services) || []; scene.bizAt = now(); }
  function market(seeds) { aiCore = 0; scene = { id: "market", t0: now(), seeds, doneAt: 0 }; probes = seeds.map((s, j) => ({ a: (j / Math.max(1, seeds.length)) * Math.PI * 2 - Math.PI / 2, t: now() + j * 120 })); }
  function marketDone(extra) {
    if (scene && scene.id === "market") scene.doneAt = now();
    const rk = {}; SCAN.ranked.forEach(r => rk[r.k] = r.p);
    const list = [...SCAN.universe, ...(extra || [])];
    let n = 0, val = 0;
    list.forEach((u, j) => setTimeout(() => { if (byK[u.k]) return; const p = rk[u.k]; addPart(u.k, u.v, false, !!(p && p <= 20), status(p)); n++; val += u.v * SUM10; if (j % 9 === 0) { $("#cSearch").textContent = fmt(n); $("#cValue").textContent = fmt(val); } }, j * (REPLAY ? 2 / SPEED : 3)));
    setTimeout(() => { probes = []; setTopics(); $("#cSearch").textContent = fmt(SCAN.universe.length); tween($("#cValue"), SCAN.universe.reduce((a, u) => a + u.v * SUM10, 0), fmt, 900); }, Math.min(1800, list.length * 3) + 300);
  }
  function filter(list) { scene = { id: "filter", t0: now() }; aiCore = 1; rows = list.map(x => ({ k: x.k, st: null })); }
  function filterMark(k, ok, why) {
    const r = rows.find(x => x.k === k && x.st == null); if (r) { r.st = ok; r.why = why; r.at = now(); }
    const p = byK[k]; if (p) { if (ok) p.keep = now(); else { p.gone = 1; p.vy = -1.5; } }
  }
  function local() {
    aiCore = 0; scene = { id: "local", t0: now() };
    const m = {}; SCAN.universe.forEach(u => m[u.k] = u);
    parts.forEach(p => { const u = m[p.k]; if (!p.gone) p.tr = u ? sizeOf(u.v * 25) : 0.6; });
    tween($("#cValue"), SCAN.universe.reduce((a, u) => a + u.v * SUM10, 0), fmt, 1200);
    setTopics();
  }
  function comp() {
    aiCore = 0;
    const R0 = compute(SCAN);
    const list = R0.comps.slice(0, mob ? 6 : 7).map(c => ({ d: c.d, v: c.clicks }));
    list.push({ d: SCAN.domain, v: R0.you.bClicks, me: true }); list.sort((a, b) => b.v - a.v);
    scene = { id: "comp", t0: now(), list };
    parts.forEach(p => { if (p.gone) p.a = 0; });
    const idx = {}; SCAN.universe.forEach((u, i) => idx[i] = u.k);
    SCAN.comps.slice(0, 7).forEach((c, j) => setTimeout(() => {
      const own = Object.entries(c.pos).filter(([i, p]) => p <= 3).map(([i]) => byK[idx[i]]).filter(Boolean).slice(0, 60);
      comps.push({ d: c.d, a: (j / 7) * Math.PI * 2 - 1.2, r: 5 + Math.min(9, own.length / 6), own, x: CX, y: CY });
    }, j * 260 / (REPLAY ? SPEED : 1)));
  }
  function serpTile(s) { if (!scene || scene.id !== "serp") scene = { id: "serp", t0: now() }; tiles.push({ ...s, t: now() }); const p = byK[s.k]; if (p) p.ping = now(); }
  function gapStart() { scene = { id: "gap", t0: now() }; gapList = []; }
  async function gap() {
    if (!scene || scene.id !== "gap") gapStart();
    phase = 1;
    const st = {}; R.items.forEach(x => st[x.k] = x);
    parts.forEach(p => { const x = st[p.k]; p.mine = !!(x && ((x.p && x.p <= 20) || x.pk)); if (x) p.st = x.st; });
    // rebuild planets from final competitor list with AI types
    const top = R.comps.slice(0, 7);
    comps = top.map((c, j) => { const own = Object.entries(c.pos).filter(([i, q]) => q <= 10 && !(R.items[i].p && R.items[i].p <= 10)).map(([i]) => byK[R.items[i].k]).filter(Boolean).slice(0, 80); return { d: c.d, type: c.type, typeAt: now() + 600 + j * 200, a: (j / top.length) * Math.PI * 2 - 1.2, r: 5 + Math.min(10, own.length / 6), own, x: CX, y: CY }; });
    gapList = R.comps.slice().sort((a, b) => b.ownClicks - a.ownClicks).slice(0, mob ? 4 : 6).map(c => ({ d: c.d, type: c.type, own: c.own, ownClicks: c.ownClicks }));
    scene.t0 = Math.min(scene.t0, now());
    tween($("#cValue"), R.market.clicks, fmt, 1200);
    tween($("#cTable"), R.missing.clicks, fmt, 2200);
    $("#cTableL").textContent = "visits/mo going to others";
    await sleep(REPLAY ? 2600 / SPEED : 3200);
  }
  function proj(sc) {
    scene = { id: "proj", t0: now(), sc }; phase = 2;
    const gold = parts.filter(p => !p.mine && !p.gone).sort((a, b) => b.v - a.v);
    const frac = Math.min(0.9, R.table.clicks ? sc.gain / R.table.clicks : 0.2);
    const n = Math.max(1, Math.round(gold.length * Math.max(0.08, frac)));
    gold.slice(0, n).forEach((p, j) => setTimeout(() => { p.won = 1; p.ping = now(); }, 400 + j * (3000 / n) / (REPLAY ? SPEED : 1)));
    $("#cTableL").textContent = "+ visits/mo in 12 months";
    setTimeout(() => tween($("#cTable"), sc.gain, v => "+" + fmt(v), 2600), 300);
  }
  return { start, stop, foot, brain, brainDone, market, marketDone, filter, filterMark, local, comp, serpTile, gapStart, gap, proj };
})();

function tween(el, to, f = fmt, ms = 1400) {
  const s = performance.now();
  (function step() { const p = Math.min(1, (performance.now() - s) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = f(to * e); if (p < 1) requestAnimationFrame(step); })();
}

function openOverlay() {
  $("#scan").classList.add("on"); $("#scDone").classList.remove("on"); $("#log").innerHTML = "";
  $("#cSearch").textContent = "0"; $("#cValue").textContent = "0"; $("#cTable").textContent = "–"; $("#scCost").textContent = "$0.000";
  $("#cTableL").textContent = "visits/mo going to others";
  $("#scDomain").textContent = SCAN.domain;
  $("#scMarket").textContent = (SCAN.keyword ? " · " + SCAN.keyword : "") + " · " + SCAN.location.label;
  $("#scSpeed").style.display = REPLAY ? "" : "none"; $("#scSkip").style.display = REPLAY ? "" : "none";
  $("#scSpeed").textContent = "Speed " + SPEED + "×";
  document.body.style.overflow = "hidden";
  VIZ.start(SCAN.domain);
  log(`❯ scan ${SCAN.domain}${SCAN.keyword ? ' --keyword "' + SCAN.keyword + '"' : ""} --location "${SCAN.location.label}"`, "", false);
}
function closeOverlay() { VIZ.stop(); $("#scan").classList.remove("on"); document.body.style.overflow = ""; }
function finishOverlay() {
  const sc = scenarios(R).exp;
  $("#scSteps").querySelectorAll("div").forEach(d => d.className = "done");
  $("#sdVal").textContent = "+" + fmt(sc.gain) + " visits/mo";
  $("#sdTxt").innerHTML = `a realistic 12-month gain for <b>${esc(SCAN.domain)}</b>, from ${fmt(R.you.clicks)} to <b>${fmt(sc.months[12].clicks)}</b> visits a month. Competitors take <b>${fmt(R.missing.clicks)}</b> visits a month in this market today.${sc.gainVal ? ` <span style="color:var(--dim)">Click value: ${money(sc.gainVal)}/mo.</span>` : ""}`;
  $("#scDone").classList.add("on");
}
function toggleSpeed() { SPEED = SPEED === 1 ? 2 : SPEED === 2 ? 4 : 1; $("#scSpeed").textContent = "Speed " + SPEED + "×"; }
function skipScan() { SKIP = true; }

async function replay(scan) {
  SCAN = JSON.parse(JSON.stringify(scan)); REPLAY = true; SKIP = false;
  SCAN.serps = SCAN.serps || []; SCAN.youPos = SCAN.youPos || {}; SCAN.dropped = SCAN.dropped || [];
  const serps = SCAN.serps; SCAN.serps = [];
  openOverlay();
  let cost = 0;
  const lines = id => (SCAN.log || []).filter(l => l[0] === id);
  const play = async (id, dur) => { const ls = lines(id); for (const l of ls) { if (SKIP) return; log(l[2], l[1], false); const m = l[2].match(/\$([\d.]+)/); if (l[2].startsWith("→") && m) { cost += +m[1]; $("#scCost").textContent = "$" + cost.toFixed(3); } await sleep(dur / Math.max(2, ls.length + 1)); } };
  for (const s of activeSteps()) {
    if (SKIP) break;
    stepUI(s.id);
    const dur = Math.max(s.min, Math.min(s.min + 3, SCAN.durations?.[s.id] || s.min)) * 1000 / SPEED;
    const t0 = performance.now();
    if (s.id === "foot") { VIZ.foot(); await play(s.id, dur * 0.8); }
    else if (s.id === "brain") { VIZ.brain(SCAN.ranked.slice().sort((a, b) => b.v - a.v).slice(0, 16).map(r => r.k)); await sleep(dur * 0.35); VIZ.brainDone(); await play(s.id, dur * 0.5); }
    else if (s.id === "market") { VIZ.market((SCAN.aiSeeds && SCAN.aiSeeds.length ? SCAN.aiSeeds : SCAN.seeds.length ? SCAN.seeds : [SCAN.domain]).slice(0, 6)); await sleep(dur * 0.3); VIZ.marketDone(SCAN.dropped); await play(s.id, dur * 0.5); }
    else if (s.id === "filter") {
      const all = [...SCAN.universe.map(u => ({ k: u.k, v: u.v, ok: true })), ...SCAN.dropped.map(d => ({ k: d.k, v: d.v, ok: false, why: d.why }))].sort((a, b) => b.v - a.v).slice(0, 160);
      VIZ.filter(all); const per = dur * 0.85 / all.length;
      for (const x of all) { if (SKIP) break; VIZ.filterMark(x.k, x.ok, x.why); await sleep(per); }
      await play(s.id, dur * 0.15);
    }
    else if (s.id === "local") { VIZ.local(); await play(s.id, dur * 0.8); }
    else if (s.id === "comp") { VIZ.comp(); await play(s.id, dur * 0.8); }
    else if (s.id === "serp") { for (const x of serps) { if (SKIP) break; SCAN.serps.push(x); VIZ.serpTile(x); await sleep(dur / Math.max(1, serps.length)); } await play(s.id, 400); }
    else if (s.id === "gap") { SCAN.serps = serps; R = compute(SCAN); VIZ.gapStart(); await VIZ.gap(); await play(s.id, dur * 0.4); }
    else if (s.id === "proj") { VIZ.proj(scenarios(R).exp); await play(s.id, dur * 0.4); }
    const rest = dur - (performance.now() - t0); if (rest > 0 && !SKIP) await sleep(rest);
  }
  SCAN.serps = serps;
  R = compute(SCAN);
  if (SKIP) { closeOverlay(); if (EMBED) return postDigest(); showResults(true); return; }
  finishOverlay();
  if (EMBED) { await sleep(1800); postDigest(); }
}
function replayCurrent() { if (SCAN) replay(SCAN); }

/* ---------- results ---------- */
const fav = d => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
function showResults(instant) {
  closeOverlay();
  $("#start").style.display = "none"; $("#results").classList.add("on");
  window.scrollTo(0, 0);
  const S = SCAN, Rr = R;
  $("#rFav").src = fav(S.domain); $("#rDomain").textContent = S.domain;
  $("#rSub").textContent = `${S.keyword ? "Market: " + S.keyword : "Market: searches related to the site"} · ${S.location.label}${S.location.region && S.localFailed ? " (national volumes)" : ""} · scanned ${new Date(S.date).toLocaleDateString()}${S.note ? " · note: " + S.note : ""}`;
  const sc = scenarios(Rr).exp, pctS = Rr.market.clicks ? 100 * Rr.you.clicks / Rr.market.clicks : 0;
  $("#rHeadline").innerHTML = `${esc(S.domain)} gets <span class="gr">${fmt(Rr.you.clicks)} visits</span> a month from this market. Competitors take <span style="color:var(--red)">${fmt(Rr.missing.clicks)}</span>. A realistic 12-month plan adds <span class="gd">+${fmt(sc.gain)} visits</span> a month.`;
  countUp("#kYou", Rr.you.clicks, fmt); $("#kYouS").innerHTML = `visits/mo · <b>${pctS < 1 ? pctS.toFixed(1) : Math.round(pctS)}%</b> of the market · <b>${Rr.you.kw3}</b> searches in the top 3 <span class="dimv">· ${money(Rr.you.value)} click value</span>`;
  countUp("#kMarket", Rr.missing.clicks, fmt); $("#kMarketS").innerHTML = `visits/mo of <b>${fmt(Rr.market.clicks)}</b> in this market · <b>${fmt(Rr.notYours.n)}</b> searches where you're not on page one <span class="dimv">· ${money(Rr.missing.value)}</span>`;
  countUp("#kTable", sc.gain, v => "+" + fmt(v)); $("#kTableS").innerHTML = `visits/mo by month 12 (${Rr.you.clicks > 0 ? "+" + Math.round(100 * sc.gain / Rr.you.clicks) + "%" : "from zero"}) · full potential <b>+${fmt(Rr.table.clicks)}</b> at top 3 everywhere <span class="dimv">· ${money(sc.gainVal)}/mo</span>`;
  renderAI();
  // share bar
  const top5 = Rr.comps.slice(0, 5), tot = Rr.basis.clicks || 1;
  const segs = [{ l: "You", v: Rr.you.bClicks, c: "#3ee98a" }, ...top5.map((c, j) => ({ l: c.d, v: c.clicks, c: ["#ff5d6c", "#ff8a3d", "#ff4fa8", "#c084fc", "#818cf8"][j] })), { l: "Everyone else", v: Rr.rest, c: "#2a2e58" }];
  $("#bar3").innerHTML = segs.map(s => `<i style="background:${s.c}" data-w="${100 * s.v / tot}">${100 * s.v / tot > 7 ? `<span>${esc(s.l)} ${Math.round(100 * s.v / tot)}%</span>` : ""}</i>`).join("");
  $("#bar3l").innerHTML = segs.map(s => `<span><i style="background:${s.c}"></i>${esc(s.l)} · ${(100 * s.v / tot).toFixed(1)}%</span>`).join("");
  $("#pieTot").textContent = Rr.basis.local ? `${Rr.basis.n} top searches, live in ${SCAN.location.city || SCAN.location.region} · ${fmt(tot)} clicks/mo` : fmt(tot) + " organic clicks / month";
  setTimeout(() => document.querySelectorAll("#bar3 i").forEach(i => i.style.width = Math.max(0.4, +i.dataset.w) + "%"), 150);
  renderLadder();
  renderComps(); renderSerps(); renderTopics(); renderTable("all"); renderMethod(); renderOverview(); setTimeout(renderProjection, 80);
  setTimeout(() => UNI.init(), 60);
}
function countUp(sel, to, f) { tween($(sel), to, f, 1600); }
function renderAI() {
  const A = SCAN.ai, box = $("#aiBox");
  if (!A || !A.biz) { box.style.display = "none"; return; }
  const nm = { geo: "other locations", job: "jobs & careers", brand: "brand names", off: "off-topic" };
  const by = {}; (SCAN.dropped || []).forEach(d => by[d.why] = (by[d.why] || 0) + 1);
  const types = A.types || {}, nd = Object.values(types).filter(t => t === "direct").length;
  box.style.display = "";
  box.innerHTML = `<div class="ah"><i>AI</i>AI analyst · ${esc(A.model || "")}</div><div class="biz">${esc(A.biz)}</div>${A.takeaway ? `<p class="tk">${esc(A.takeaway)}</p>` : ""}${A.moves && A.moves.length ? `<ol>${A.moves.map(m => `<li>${esc(m)}</li>`).join("")}</ol>` : ""}
  <div class="chips">${(A.services || []).map(s => `<span class="chip2 v">${esc(s)}</span>`).join("")}</div>
  <details><summary>AI kept <b>${fmt(SCAN.universe.length)}</b> of ${fmt(SCAN.aiChecked || SCAN.universe.length + (SCAN.dropped || []).length)} searches as relevant${Object.keys(by).length ? " · dropped " + Object.entries(by).map(([k, n]) => `${n} ${nm[k] || k}`).join(", ") : ""}${Object.keys(types).length ? ` · ${nd} of ${Object.keys(types).length} top competitors are direct competitors` : ""}</summary><div class="drop">${(SCAN.dropped || []).slice(0, 80).map(d => `<span title="${esc(nm[d.why] || d.why)}">${esc(d.k)}</span>`).join("")}</div></details>`;
}

function renderComps() {
  const Rr = R, list = Rr.comps.slice(0, 10);
  const max = Math.max(Rr.you.bClicks, ...list.map(c => c.clicks), 1);
  const rows = list.map((c, j) => ({ ...c, n: j + 1 }));
  const meRow = { ...Rr.you, clicks: Rr.you.bClicks }; if (Rr.you.rank <= 10) rows.splice(Rr.you.rank - 1, 0, meRow); else rows.push(meRow);
  rows.forEach((r, j) => { if (!r.me) r.n = j + 1 - (rows.slice(0, j).some(x => x.me) && Rr.you.rank <= 10 ? 0 : 0); });
  let n = 0;
  $("#compList").innerHTML = rows.slice(0, 11).map(r => {
    if (!r.me) n++;
    const rank = r.me ? (Rr.you.bClicks > 0 ? Rr.you.rank : null) : (Rr.you.bClicks > 0 && n >= Rr.you.rank ? n + 1 : n);
    return `<div class="crow ${r.me ? "me" : ""}"><div class="n">${rank ? "#" + rank : "–"}</div><div class="d"><b><img src="${fav(r.d)}" alt="">${esc(r.d)} ${r.me ? '<span class="tag you">you</span>' : r.type ? `<span class="tag ${r.type}">${r.type}</span>` : ""}</b><div class="track"><i data-w="${100 * r.clicks / max}"></i></div></div><div class="m">${fmt(r.clicks)}<span>visits/mo</span></div><div class="m">${(r.share * 100).toFixed(1)}%<span>${r.me ? r.kw3 + " top-3" : fmt(r.own) + " kw you lack"}</span></div></div>`;
  }).join("");
  setTimeout(() => document.querySelectorAll("#compList .track i").forEach(i => i.style.width = Math.max(0.5, +i.dataset.w) + "%"), 200);
  const lead = Rr.comps[0];
  const basisTxt = Rr.basis.local ? ` Measured on the ${Rr.basis.n} most valuable searches, checked live from ${esc(SCAN.location.city || SCAN.location.region)} including the map pack (${Math.round(Rr.basis.pct * 100)}% of the market's value).` : "";
  $("#compLd").innerHTML = (lead ? `<b>${esc(lead.d)}</b> leads this market with about ${fmt(lead.clicks)} visits a month (${(lead.share * 100).toFixed(1)}% of clicks). ${Rr.you.bClicks <= 0 ? "You don't show up in these results yet." : Rr.you.rank <= 10 ? `You're #${Rr.you.rank}.` : `You're #${Rr.you.rank} among the sites we found.`}` : "") + basisTxt;
  // donut
  const segs = [{ l: "You", v: Rr.you.bClicks, c: "#3ee98a" }, ...Rr.comps.slice(0, 5).map((c, j) => ({ l: c.d, v: c.clicks, c: ["#ff5d6c", "#ff8a3d", "#ff4fa8", "#c084fc", "#818cf8"][j] })), { l: "Everyone else", v: Rr.rest, c: "#2a2e58" }];
  const tot = segs.reduce((a, s) => a + s.v, 0) || 1;
  const svg = d3.select("#donut"); svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", "translate(130,130)");
  const arc = d3.arc().innerRadius(78).outerRadius(118).cornerRadius(3).padAngle(0.012);
  const pie = d3.pie().sort(null).value(d => d.v)(segs);
  g.selectAll("path").data(pie).enter().append("path").attr("fill", d => d.data.c).transition().duration(1400).delay((d, i) => i * 120).attrTween("d", d => { const i = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d); return t => arc(i(t)); });
  g.append("text").attr("text-anchor", "middle").attr("y", -4).attr("fill", "#3ee98a").attr("font-size", 32).attr("font-weight", 900).text(((Rr.you.share) * 100).toFixed(Rr.you.share < 0.1 ? 1 : 0) + "%");
  g.append("text").attr("text-anchor", "middle").attr("y", 18).attr("fill", "#7a7fae").attr("font-size", 11).attr("font-family", "JetBrains Mono").text("your share of clicks");
  $("#donutL").innerHTML = segs.map(s => `<div><span><i style="background:${s.c}"></i>${esc(s.l)}</span><b>${(100 * s.v / tot).toFixed(1)}%</b></div>`).join("");
}

function renderSerps() {
  const S = SCAN;
  if (!S.serps || !S.serps.length) { $("#serpSec").style.display = "none"; return; }
  $("#serpSec").style.display = ""; $("#serpH").textContent = `What searchers in ${S.location.region} actually see`;
  const mine = d => d === S.domain || d.endsWith("." + S.domain);
  $("#serps").innerHTML = S.serps.slice(0, 10).map(s => `<div class="card serp"><h5 title="${esc(s.k)}">${esc(s.k)}</h5>${s.lp.length ? `<div class="rk" style="color:var(--cyan)"><i>map</i>${esc(s.lp.map(l => l[0]).join(" · ").slice(0, 60))}</div>` : ""}${s.org.slice(0, 6).map(o => `<div class="rk ${mine(o[0]) ? "me" : ""}"><i>${o[1]}</i>${esc(o[0])}</div>`).join("")}<div class="yp" style="color:${s.you && s.you <= 3 ? "var(--green2)" : s.you ? "var(--gold)" : "var(--red)"}">${s.you ? "you: #" + s.you : "you: not in top 20"}${s.youLp ? " · in map pack" : ""}${s.ads ? ` · ${s.ads} ads` : ""}</div></div>`).join("");
}

function renderTopics() {
  const Rr = R;
  $("#topics").innerHTML = Rr.topics.slice(0, 9).map(t => {
    const ys = Math.min(100, t.share * 100), ls = Math.min(100 - ys, t.leadShare * 100);
    return `<div class="card topic"><h4>${esc(t.name)}${t.core ? ' <span class="tag">core</span>' : ""}</h4><div class="meta">${fmt(t.n)} searches · ${fmt(t.clicks)} visits/mo in play</div>
    <div class="big"><b>+${fmt(t.pot)}</b><span>visits/mo open${t.potVal ? " · " + money(t.potVal) : ""}</span></div>
    <div class="sbar"><i style="width:${ys}%;background:var(--green)"></i><i style="width:${ls}%;background:var(--red)"></i></div>
    <div class="own"><span>you ${ys.toFixed(ys < 1 ? 1 : 0)}%</span><b>${t.lead ? "leader: " + esc(t.lead.d) + " " + Math.round(ls) + "%" : "no clear leader"}</b></div></div>`;
  }).join("");
}

let SORT = { k: "pot", dir: -1 }, TAB = "all", SHOWALL = false;
function renderTable(tab) {
  if (tab) TAB = tab;
  document.querySelectorAll("#oTabs button").forEach(b => b.classList.toggle("on", b.dataset.v === TAB));
  let xs = R.items.slice();
  if (TAB === "close") xs = xs.filter(x => x.p && x.p > 3 && x.p <= 20);
  else if (TAB === "none") xs = xs.filter(x => !x.p || x.p > 20);
  else if (TAB === "mine") xs = xs.filter(x => x.p && x.p <= 3);
  else xs = xs.filter(x => x.pot > 0);
  const anyVal = R.items.some(x => x.c > 0);
  const key = SORT.k;
  xs.sort((a, b) => { const d = (a[key] ?? -1) - (b[key] ?? -1); return SORT.dir < 0 ? -d : d; });
  const lim = innerWidth < 700 && !SHOWALL ? 15 : 80;
  const cols = [["k", "Search"], ["topic", "Topic"], ["v", "Searches/mo"], ["c", "CPC"], ["d", "Difficulty"], ["p", "You"], ["lead", "#1 right now"], ["pot", "+ Visits/mo"], ["potVal", "+ Value/mo"]];
  $("#oTable").innerHTML = `<tr>${cols.map(([k, l]) => `<th data-k="${k}" class="${["v", "c", "d", "pot", "potVal"].includes(k) ? "n" : ""}">${l}${SORT.k === k ? (SORT.dir < 0 ? " ↓" : " ↑") : ""}</th>`).join("")}</tr>` +
    xs.slice(0, lim).map(x => `<tr><td class="kw">${esc(x.k)}</td><td class="hm" style="color:var(--muted);text-transform:capitalize">${esc(x.topic || "")}</td><td class="n" data-l="Searches" ${x.ve ? 'title="estimated from national volume"' : ""}>${x.ve ? "~" : ""}${fmt(x.v)}</td><td class="n" data-l="CPC" ${x.ce ? 'title="estimated from the market median"' : ""}>${x.c ? (x.ce ? "~" : "") + "$" + x.c.toFixed(2) : "–"}</td><td class="n hm">${x.d ?? "–"}</td><td data-l="You"><span class="pos ${x.st}">${x.p ? "#" + x.p : "–"}</span></td><td data-l="#1 now" style="font-size:13px;color:var(--muted);overflow:hidden;text-overflow:ellipsis">${x.lead ? (x.lead.me ? '<span class="tag you">you</span>' : esc(x.lead.d)) + ` <span class="mono" style="color:var(--dim)">#${x.lead.p}</span>` : "–"}</td><td class="n gain" data-l="+ Visits">${x.pot ? "+" + fmt(x.pot) : "–"}</td><td class="n gain" data-l="+ Value">${x.potVal ? money(x.potVal) : "–"}</td></tr>`).join("") +
    (xs.length ? "" : `<tr><td colspan="9" style="color:var(--dim);padding:20px">Nothing here.</td></tr>`) + (xs.length > lim && lim < 80 ? `<tr class="more"><td colspan="9"><button class="btn sm" onclick="SHOWALL=true;renderTable()">Show ${Math.min(80, xs.length) - lim} more</button></td></tr>` : "");
  document.querySelectorAll("#oTable th").forEach(th => th.onclick = () => { const k = th.dataset.k; if (k === "topic" || k === "lead" || k === "k") return; SORT = { k, dir: SORT.k === k ? -SORT.dir : -1 }; renderTable(); });
}

function renderMethod() {
  const S = SCAN;
  $("#method").innerHTML = `<b>How this is calculated.</b> The market is ${S.seeds.length ? `every search DataForSEO Labs relates to “${esc(S.keyword)}”` : "the searches DataForSEO Labs finds relevant to the site"}, plus the site's own matching rankings (${fmt(R.items.length)} searches). ${S.location.region && !S.localFailed ? `Search volumes and CPCs are Google Ads data for ${esc(S.location.region)}. Rankings come from DataForSEO's US index, except the ${S.serps.length} searches checked live in ${esc(S.location.region)}, which use those local results.` : `Search volumes, CPCs and rankings are for ${esc(S.location.label)}.`} Clicks use a standard organic click-through curve (about 22% for #1, 13% for #2, 9% for #3, falling to 1.5% at #10). “Left on the table” is the extra clicks you'd get at an average top-3 position on every search where you're below it. Click value is clicks × CPC, what the same traffic would cost in Google Ads. Competitor shares cover the ${Math.min(800, R.items.length)} most valuable searches. Estimates, not guarantees.<br>Scan cost $${(S.cost || 0).toFixed(2)} · ${S.calls.length} API calls · ${S.runtime || "–"}s · built with <a href="https://github.com/jourdanrombough/left-on-the-table">Left on the Table</a> by <a href="https://optimizationtheory.com/about-jourdan-rombough-seo-web-visibility-expert/">Jourdan Rombough</a>.`;
}

/* ---------- universe chart ---------- */
const UNI = (() => {
  let cv, ctx, W, H, D, nodes = [], groups = [], filt = "all", sizeBy = "vol", raf, hover = null;
  function init() {
    cv = $("#uni"); ctx = cv.getContext("2d");
    document.querySelectorAll("#uFilter button").forEach(b => b.onclick = () => { filt = b.dataset.v; document.querySelectorAll("#uFilter button").forEach(x => x.classList.toggle("on", x === b)); });
    document.querySelectorAll("#uSize button").forEach(b => b.onclick = () => { sizeBy = b.dataset.v; document.querySelectorAll("#uSize button").forEach(x => x.classList.toggle("on", x === b)); layout(false); });
    cv.onmousemove = e => { const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; hover = null; for (let i = nodes.length - 1; i >= 0; i--) { const n = nodes[i]; if ((x - n.x) ** 2 + (y - n.y) ** 2 <= Math.max(16, n.r * n.r)) { hover = n; break; } } tip(e, hover); };
    cv.onmouseleave = () => { hover = null; tip(null); };
    cv.addEventListener("touchstart", e => { const t = e.touches[0]; cv.onmousemove({ clientX: t.clientX, clientY: t.clientY }); setTimeout(() => { hover = null; tip(null); }, 2600); }, { passive: true });
    resize(); layout(true);
    cancelAnimationFrame(raf); draw();
    let lastW = innerWidth; window.addEventListener("resize", () => { if (Math.abs(innerWidth - lastW) < 2) return; lastW = innerWidth; resize(); layout(false); });
  }
  function resize() { D = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * D; cv.height = H * D; ctx.setTransform(D, 0, 0, D, 0, 0); }
  const GC = ["#2fd0ff", "#2fd0ff", "#9b8cff", "#ff4fa8", "#ff8a3d", "#2dd4bf", "#818cf8", "#e879f9", "#60a5fa", "#fb7185", "#34d399", "#c084fc", "#38bdf8", "#f59e0b", "#a3e635", "#94a3b8"];
  function subText(g) { return `${g.n} searches · +${fmt(g.pot)} visits open`; }
  function pillW(g) { ctx.font = "800 11.5px JetBrains Mono"; const a = ctx.measureText(g.name.toUpperCase()).width + 28; ctx.font = "500 10.5px JetBrains Mono"; return Math.max(a, ctx.measureText(subText(g)).width + 20); }
  function layout(first) {
    const xs = R.items.slice().sort((a, b) => b.mkVal - a.mkVal).slice(0, 750);
    const useVal = sizeBy === "value" && xs.some(x => x.mkVal > 0);
    const tops = R.topics.slice(0, 16).map(t => t.name);
    let gs = tops.map(n => ({ name: n, children: [] }));
    const other = { name: "other", children: [] };
    xs.forEach(x => { const g = gs.find(c => c.name === x.topic) || other; g.children.push({ x, raw: useVal ? x.mkVal : x.v }); });
    const mxRaw = Math.max(1, ...xs.map(x => useVal ? x.mkVal : x.v));
    if (other.children.length) gs.push(other);
    gs = gs.filter(c => c.children.length);
    gs.forEach(g => g.children.forEach(c => c.value = Math.pow(Math.max(c.raw, mxRaw * 0.0015), 0.5)));
    gs.forEach(g => g.sum = g.children.reduce((a, c) => a + c.value, 0));
    gs.sort((a, b) => b.sum - a.sum);
    groups = gs.map((c, j) => { const t = R.topics.find(q => q.name === c.name); return { name: c.name, col: GC[j % GC.length], n: c.children.length, val: t ? t.value : 0, pot: t ? t.pot : 0, isVal: false, data: c }; });
    const prev = {}; nodes.forEach(n => prev[n.x0.k] = n);
    const leaves = [];
    if (true) {
      // each keyword group gets its own titled cluster; clusters flow in centered rows
      const mob = W < 700, maxSum = groups[0].data.sum, Dmax = mob ? W - 40 : Math.min(460, W * 0.42), Dmin = mob ? 96 : 120;
      const rows = []; let row = [], rw = 0;
      groups.forEach(g => {
        g.D = Math.max(Dmin, Dmax * Math.sqrt(g.data.sum / maxSum)); g.pw = pillW(g); g.cw = Math.max(g.D, g.pw) + (mob ? 14 : 30);
        if (rw + g.cw > W - 20 && row.length) { rows.push(row); row = []; rw = 0; }
        row.push(g); rw += g.cw;
      });
      if (row.length) rows.push(row);
      let y = mob ? 92 : 70;
      rows.forEach(rr => {
        const tot = rr.reduce((a, g) => a + g.cw, 0); let x = (W - tot) / 2; const rowH = Math.max(...rr.map(g => g.D)) + 58;
        rr.forEach(g => { g.cx = x + g.cw / 2; g.cy = y + 40 + (rowH - 58) / 2; g.r = g.D / 2; g.lab = { x: Math.max(4, Math.min(W - g.pw - 4, g.cx - g.pw / 2)), y: g.cy - g.r - 38, w: g.pw, h: 32 }; x += g.cw; });
        y += rowH;
      });
      const need = y + 64;
      if (Math.abs(cv.parentElement.clientHeight - need) > 2) { cv.parentElement.style.height = need + "px"; resize(); }
      groups.forEach(g => {
        const h = d3.hierarchy({ children: g.data.children }).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
        d3.pack().size([g.r * 2, g.r * 2]).padding(1.2)(h);
        g.x = g.cx; g.y = g.cy;
        h.leaves().forEach(l => leaves.push({ l, ox: g.cx - g.r, oy: g.cy - g.r, g }));
      });
    } else {
      const TOP = 46, PAD = 38;
      const h = d3.hierarchy({ children: gs }).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
      d3.pack().size([W - 20, H - TOP - 50]).padding(d => d.depth === 0 ? PAD : 1.2)(h);
      h.children.forEach(c => { const g = groups.find(q => q.data === c.data); g.x = c.x + 10; g.y = c.y + TOP; g.r = c.r; });
      h.leaves().forEach(l => leaves.push({ l, ox: 10, oy: TOP, g: groups.find(q => q.data === l.parent.data) }));
      const placed = [];
      groups.forEach(g => {
        const w = pillW(g), hh = 32;
        let y = g.y - g.r - hh - 2, x = Math.max(4, Math.min(W - w - 4, g.x - w / 2));
        const hit = r => placed.some(q => !(r.x + r.w < q.x || q.x + q.w < r.x || r.y + r.h < q.y || q.y + q.h < r.y));
        let tries = 0; while ((y < 2 || hit({ x, y, w, h: hh })) && tries++ < 14) y = y < 2 ? g.y - g.r + 4 : y + 12;
        g.lab = { x, y, w, h: hh }; placed.push(g.lab);
      });
    }
    nodes = leaves.map(({ l, ox, oy, g }, j) => { const p = prev[l.data.x.k]; return { x0: l.data.x, col: g.col, tx: l.x + ox, ty: l.y + oy, tr: l.r, x: p ? p.x : g.x, y: p ? p.y : g.y, r: p ? p.r : 0, delay: first ? j * 1.6 : 0, born: performance.now() }; });
    groups.forEach(g => g.born = performance.now());
  }
  function draw() {
    const t = performance.now();
    ctx.clearRect(0, 0, W, H);
    groups.forEach(g => { ctx.globalAlpha = .55; ctx.strokeStyle = g.col; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(g.x, g.y, g.r + 3, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = .05; ctx.fillStyle = g.col; ctx.fill(); ctx.globalAlpha = 1; });
    nodes.forEach(n => {
      if (t - n.born < n.delay) return;
      n.x += (n.tx - n.x) * 0.09; n.y += (n.ty - n.y) * 0.09; n.r += (n.tr - n.r) * 0.09;
      const x = n.x0, show = filt === "all" || (filt === "miss" ? (!x.p || x.p > 3) : (x.p && x.p <= 20));
      ctx.globalAlpha = show ? 1 : 0.08;
      if (x.st === "none") { ctx.fillStyle = "#141735"; ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(0.5, n.r - 0.5), 0, 7); ctx.fill(); const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.28; ctx.fillStyle = n.col || "#2a2e58"; ctx.fill(); ctx.globalAlpha = ga; ctx.strokeStyle = filt === "miss" ? `rgba(255,193,59,${0.55 + 0.3 * Math.sin(t / 400 + n.tx)})` : "rgba(255,193,59,.32)"; ctx.lineWidth = 1; ctx.stroke(); }
      else { ctx.fillStyle = COLORS[x.st]; ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(0.5, n.r - 0.5), 0, 7); ctx.fill(); }
      if (n === hover) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2, 0, 7); ctx.stroke(); }
      if (n.r > 22 && show && Math.abs(n.r - n.tr) < 2) { const fs = Math.min(12.5, Math.max(8.5, n.r / 3.6)); ctx.font = `600 ${fs}px "Instrument Sans"`; ctx.textAlign = "center"; ctx.fillStyle = x.st === "none" ? "#b3b7e0" : "#0a0b19"; let w = x.k; const maxW = n.r * 1.7; while (w.length > 4 && ctx.measureText(w).width > maxW) w = w.slice(0, -2); if (w !== x.k) w = w.slice(0, -1) + "…"; ctx.fillText(w, n.x, n.y + 2); ctx.font = `500 ${fs * 0.85}px JetBrains Mono`; ctx.globalAlpha *= .75; ctx.fillText(x.mkVal ? money(x.mkVal) : fmt(x.v), n.x, n.y + 2 + fs * 1.2); }
    });
    ctx.globalAlpha = 1;
    groups.forEach((g, j) => {
      const L = g.lab; if (!L) return; const a = Math.min(1, Math.max(0, (t - g.born - 300 - j * 90) / 500)); if (!a) return;
      ctx.globalAlpha = a; ctx.fillStyle = "rgba(10,11,25,.9)"; ctx.strokeStyle = g.col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(L.x, L.y, L.w, L.h, 8) : ctx.rect(L.x, L.y, L.w, L.h); ctx.fill(); ctx.stroke();
      ctx.fillStyle = g.col; ctx.fillRect(L.x + 8, L.y + 9, 6, 6);
      ctx.textAlign = "left"; ctx.font = "800 11.5px JetBrains Mono"; ctx.fillStyle = "#f3f4ff"; ctx.fillText(g.name.toUpperCase(), L.x + 19, L.y + 15);
      ctx.font = "500 10.5px JetBrains Mono"; ctx.fillStyle = "#7a7fae"; ctx.fillText(subText(g), L.x + 9, L.y + 27);
      ctx.globalAlpha = 1;
    });
    raf = requestAnimationFrame(draw);
  }
  function tip(e, n) {
    const T = $("#tip");
    if (!n) { T.style.display = "none"; return; }
    const x = n.x0;
    T.innerHTML = `<b>${esc(x.k)}</b><div class="r"><span>Group</span><span style="text-transform:capitalize">${esc(x.topic || "")}</span></div><div class="r"><span>Searches / mo</span><span>${fmt(x.v)}</span></div><div class="r"><span>CPC</span><span>${x.c ? "$" + x.c.toFixed(2) : "–"}</span></div><div class="r"><span>You</span><span>${x.p ? "#" + x.p : "not ranking"}</span></div><div class="r"><span>#1 right now</span><span>${x.lead ? esc(x.lead.d) : "–"}</span></div><div class="r"><span>On the table</span><span style="color:var(--gold)">+${fmt(x.pot)} visits${x.potVal ? " · " + money(x.potVal) : ""}</span></div>`;
    T.style.display = "block"; T.style.left = Math.max(8, Math.min(innerWidth - T.offsetWidth - 8, e.clientX + 16)) + "px"; T.style.top = Math.min(innerHeight - T.offsetHeight - 8, e.clientY + 16) + "px";
  }
  return { init };
})();

/* ---------- misc actions ---------- */
function goHome() { closeOverlay(); $("#results").classList.remove("on"); $("#start").style.display = ""; history.replaceState(null, "", location.pathname); loadLists(); window.scrollTo(0, 0); }
function copySummary() {
  const S = SCAN, Rr = R;
  const lines = [`${S.domain} · ${S.keyword || "site keywords"} · ${S.location.label}`,
  `You capture ${(Rr.you.share * 100).toFixed(1)}% of clicks in this market: ~${fmt(Rr.you.clicks)} visits/mo (${money(Rr.you.value)} in click value).`,
  `The market: ${fmt(Rr.items.length)} searches, ~${fmt(Rr.market.clicks)} organic clicks/mo worth ${money(Rr.market.value)}.`,
  `Left on the table: +${fmt(Rr.table.clicks)} visits/mo (${money(Rr.table.value)}/mo) by reaching the top 3.`,
  `Top competitors: ${Rr.comps.slice(0, 3).map(c => `${c.d} (${(c.share * 100).toFixed(1)}%)`).join(", ")}.`,
  `Biggest untapped topics: ${Rr.topics.slice(0, 3).map(t => `${t.name} (${t.potVal ? money(t.potVal) : "+" + fmt(t.pot) + " visits"})`).join(", ")}.`];
  navigator.clipboard?.writeText(lines.join("\n")).then(() => { $("#copyBtn").textContent = "Copied ✓"; setTimeout(() => $("#copyBtn").textContent = "Copy summary", 1600); });
}
function downloadScan() {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(SCAN)], { type: "application/json" }));
  a.download = `${SCAN.domain}-${(SCAN.keyword || "site").replace(/\W+/g, "-")}-${SCAN.location.label.replace(/\W+/g, "-")}.json`.toLowerCase(); a.click();
}

/* ---------- start-page starfield ---------- */
(function () {
  const cv = $("#starfield"), ctx = cv.getContext("2d"); let W, H;
  const rs = () => { W = cv.width = cv.clientWidth; H = cv.height = cv.clientHeight; }; rs(); addEventListener("resize", rs);
  const P = [...Array(160)].map(() => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + .3, g: Math.random() < .12, ph: Math.random() * 6 }));
  (function f(t) { if ($("#start").style.display !== "none") { ctx.clearRect(0, 0, W, H); P.forEach(p => { ctx.fillStyle = p.g ? `rgba(255,193,59,${.35 + .35 * Math.sin(t / 700 + p.ph)})` : "rgba(150,155,210,.28)"; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.r, 0, 7); ctx.fill(); }); } requestAnimationFrame(f); })(0);
})();

/* ---------- boot ---------- */
initForm(); syncRegion();
document.querySelectorAll("#oTabs button").forEach(b => b.onclick = () => renderTable(b.dataset.v));
if (EMBED) document.body.classList.add("embed");
async function demoSetup() {
  if (!window.DEMO) return;
  const T = await DEMO.load(), s = T.scan;
  document.querySelectorAll('a[href="../pitch-deck/"]').forEach(a => a.href = "../pitch-deck/?demo=1");
  $("#demoDom").textContent = s.domain; $("#demoDate").textContent = new Date(T.recorded).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  if (EMBED) return;
  $("#inDomain").value = s.domain; $("#inKw").value = s.keyword || ""; $("#inCountry").value = s.location.country; syncRegion(); $("#inRegion").value = s.location.abbr || ""; $("#inNote").value = s.note || "";
  ["#inDomain", "#inKw", "#inCountry", "#inRegion", "#inNote"].forEach(x => $(x).disabled = true);
  updateEstimate();
}
detectMode().then(demoSetup).then(() => {
  if (EMBED) {
    if (QS.get("scan")) return openFile("scan:" + QS.get("scan"), QS.get("replay") === "1");
    if (QS.get("d")) { $("#inDomain").value = QS.get("d"); $("#inKw").value = QS.get("kw") || ""; $("#inCountry").value = QS.get("cc") || "us"; syncRegion(); $("#inRegion").value = QS.get("st") || ""; $("#inNote").value = QS.get("note") || ""; return startScan(); }
  }
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("open=")) openFile(h.slice(5), true);
  else if (h.startsWith("show=")) openFile(h.slice(5), false);
});

/* ---------- traffic projection ---------- */
let SCEN = "exp";
function scenarios(Rr) {
  const it = Rr.items;
  const untapped = it.filter(x => !x.p || x.p > 20).sort((a, b) => ((a.d ?? 50) - (b.d ?? 50)) || (b.mk - a.mk) || (b.v - a.v));
  const pick = f => new Set(untapped.slice(0, Math.round(untapped.length * f)).map(x => x.i));
  const packable = it.filter(x => x.lp && !x.pk).sort((a, b) => b.v - a.v);
  const packPick = f => new Set(packable.slice(0, Math.round(packable.length * f)).map(x => x.i));
  const loc = Rr.basis && Rr.basis.local;
  const defs = {
    cons: { name: "Conservative", note: "Pages already ranking 4–20 move about halfway up. No new rankings.", mid: 5, mv: p => p > 3 && p <= 20 ? Math.max(3, Math.round(p / 2)) : p, set: new Set(), np: 0, pk: new Set() },
    exp: { name: "Expected", note: "Striking-distance pages (4–20) reach #3, the easiest 40% of untapped searches reach page one at #5" + (loc ? ", and you win a map-pack spot on a few of the live-checked searches." : "."), mid: 6, mv: p => p > 3 && p <= 20 ? 3 : p, set: pick(.4), np: 5, pk: packPick(0.15) },
    agg: { name: "Aggressive", note: "Top-3 pages reach #1, everything else ranking 4–20 reaches #2, the easiest half of untapped searches reach #4" + (loc ? ", and you win a map-pack spot on every live-checked search." : "."), mid: 7, mv: p => p <= 3 ? 1 : p <= 20 ? 2 : p, set: pick(.5), np: 4, pk: packPick(1) },
  };
  Object.values(defs).forEach(s => {
    s.pos = x => x.p && x.p <= 20 ? s.mv(x.p) : s.set.has(x.i) ? s.np : x.p;
    let pc = 0, pv = 0, pn = 0, nc = 0, nv = 0, nn = 0, mc = 0, mv = 0, mn = 0;
    it.forEach(x => {
      if (x.p && x.p <= 20) { const g = x.v * x.f * (ctr(s.mv(x.p)) - ctr(x.p)); if (g > 0) { pc += g; pv += g * (x.c || 0); pn++; } }
      else if (s.set.has(x.i)) { const g = x.v * x.f * (ctr(s.np) - ctr(x.p)); if (g > 0) { nc += g; nv += g * (x.c || 0); nn++; } }
      if (s.pk.has(x.i)) { const g = x.v * PACK[2]; mc += g; mv += g * (x.c || 0); mn++; }
    });
    const L = m => 1 / (1 + Math.exp(-(m - s.mid) / 1.6)), r = m => (L(m) - L(0)) / (L(12) - L(0));
    Object.assign(s, { push: { clicks: pc, value: pv, n: pn }, win: { clicks: nc, value: nv, n: nn }, map: { clicks: mc, value: mv, n: mn }, gain: pc + nc + mc, gainVal: pv + nv + mv });
    s.months = [...Array(13)].map((_, m) => ({ m, clicks: Rr.you.clicks + s.gain * r(m), value: Rr.you.value + s.gainVal * r(m) }));
  });
  return defs;
}
function renderProjection() {
  const SC = scenarios(R), s = SC[SCEN];
  document.querySelectorAll("#pScen button").forEach(b => { b.classList.toggle("on", b.dataset.v === SCEN); b.onclick = () => { SCEN = b.dataset.v; renderProjection(); }; });
  $("#pNote").textContent = s.note;
  const base = R.you.clicks, start = new Date(SCAN.date);
  const mlab = m => { const d = new Date(start.getFullYear(), start.getMonth() + m, 1); return m === 0 ? "Now" : d.toLocaleString("en", { month: "short" }) + (d.getMonth() === 0 ? " '" + String(d.getFullYear()).slice(2) : ""); };
  const pct = x => base > 0 ? ` (${x / base >= 10 ? Math.round(x / base) + "×" : "+" + Math.round(100 * x / base) + "%"})` : "";
  $("#pStats").innerHTML = [0, 3, 6, 12].map(m => { const v = s.months[m]; return `<div><span>${m === 0 ? "Today" : "Month " + m + " · " + mlab(m)}</span><b class="${m ? "gd" : ""}">${fmt(v.clicks)}</b><span>visits/mo${m ? pct(v.clicks - base) : ""}${v.value ? " · " + money(v.value) : ""}</span></div>`; }).join("");
  // chart
  const box = $("#projChart"), W = box.clientWidth || 600, H = box.clientHeight || 300, m = { l: 46, r: 64, t: 16, b: 28 };
  const svg = d3.select(box); svg.selectAll("*").remove(); svg.attr("viewBox", `0 0 ${W} ${H}`);
  const maxY = Math.max(base, ...Object.values(SC).map(q => q.months[12].clicks)) * 1.08 || 1;
  const x = d3.scaleLinear().domain([0, 12]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, maxY]).range([H - m.b, m.t]).nice();
  const defs = svg.append("defs"); const gr = defs.append("linearGradient").attr("id", "pg").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
  gr.append("stop").attr("offset", "0%").attr("stop-color", "#ffc13b").attr("stop-opacity", .35); gr.append("stop").attr("offset", "100%").attr("stop-color", "#ffc13b").attr("stop-opacity", 0);
  y.ticks(4).forEach(t => { svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)).attr("stroke", "#1d2044"); svg.append("text").attr("x", m.l - 8).attr("y", y(t) + 4).attr("text-anchor", "end").attr("fill", "#5d6296").attr("font-size", 10.5).attr("font-family", "JetBrains Mono").text(short(t)); });
  [0, 3, 6, 9, 12].forEach(t => svg.append("text").attr("x", x(t)).attr("y", H - 8).attr("text-anchor", "middle").attr("fill", "#5d6296").attr("font-size", 10.5).attr("font-family", "JetBrains Mono").text(mlab(t)));
  const line = d3.line().x(d => x(d.m)).y(d => y(d.clicks)).curve(d3.curveMonotoneX);
  Object.entries(SC).forEach(([k, q]) => { if (k !== SCEN) svg.append("path").attr("d", line(q.months)).attr("fill", "none").attr("stroke", "#3b3f73").attr("stroke-width", 1.5).attr("stroke-dasharray", "4 4"); });
  svg.append("path").attr("d", d3.area().x(d => x(d.m)).y0(y(base)).y1(d => y(d.clicks)).curve(d3.curveMonotoneX)(s.months)).attr("fill", "url(#pg)").attr("opacity", 0).transition().duration(1200).delay(500).attr("opacity", 1);
  svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(base)).attr("y2", y(base)).attr("stroke", "#3ee98a").attr("stroke-width", 1.5).attr("stroke-dasharray", "2 4");
  svg.append("text").attr("x", W - m.r + 6).attr("y", y(base) + 4).attr("fill", "#3ee98a").attr("font-size", 11).attr("font-family", "JetBrains Mono").text("today");
  const p = svg.append("path").attr("d", line(s.months)).attr("fill", "none").attr("stroke", "#ffc13b").attr("stroke-width", 3).attr("stroke-linecap", "round");
  const len = p.node().getTotalLength(); p.attr("stroke-dasharray", len).attr("stroke-dashoffset", len).transition().duration(1600).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);
  const end = s.months[12];
  svg.append("circle").attr("cx", x(12)).attr("cy", y(end.clicks)).attr("r", 0).attr("fill", "#ffc13b").transition().delay(1500).duration(400).attr("r", 5);
  svg.append("text").attr("x", x(12) + 8).attr("y", y(end.clicks) + 4).attr("fill", "#ffc13b").attr("font-weight", 800).attr("font-size", 13).text(short(end.clicks)).attr("opacity", 0).transition().delay(1500).attr("opacity", 1);
  // hover / touch readout
  const g = svg.append("g").style("display", "none");
  g.append("line").attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "#5d6296").attr("stroke-dasharray", "3 3");
  g.append("circle").attr("r", 5).attr("fill", "#ffc13b").attr("stroke", "#0a0b19").attr("stroke-width", 2);
  const lab = g.append("text").attr("fill", "#f3f4ff").attr("font-size", 12).attr("font-weight", 700);
  const move = ev => { const [mx] = d3.pointer(ev, box); const mm = Math.max(0, Math.min(12, Math.round(x.invert(mx)))); const d = s.months[mm]; g.style("display", null); g.select("line").attr("x1", x(mm)).attr("x2", x(mm)); g.select("circle").attr("cx", x(mm)).attr("cy", y(d.clicks)); lab.attr("x", x(mm) + (mm > 8 ? -8 : 8)).attr("y", y(d.clicks) - 12).attr("text-anchor", mm > 8 ? "end" : "start").text(`${mlab(mm)}: ${fmt(d.clicks)} visits${d.value ? " · " + money(d.value) : ""}`); };
  svg.on("pointermove", move).on("pointerdown", move).on("pointerleave", () => g.style("display", "none"));
  // breakdown
  $("#brkScen").textContent = "· " + s.name.toLowerCase();
  const rows = [
    s.push.n && { h: "Push striking-distance pages", s: `${s.push.n} searches you already rank for move up`, c: s.push.clicks, v: s.push.value },
    s.win.n && { h: "Win new rankings", s: `${s.win.n} untapped searches, easiest first`, c: s.win.clicks, v: s.win.value },
    s.map.n && { h: "Get into the map pack", s: `${s.map.n} live-checked searches show a map pack you're not in`, c: s.map.clicks, v: s.map.value },
    { h: "Total in 12 months", s: `on top of today's ${fmt(base)} visits/mo`, c: s.gain, v: s.gainVal },
  ];
  const rr = rows.filter(Boolean), mx = Math.max(1, ...rr.map(r => r.c));
  $("#brk").innerHTML = rr.map(r => `<div class="brow"><div class="h"><span>${r.h}</span><b>+${fmt(r.c)}</b></div><div class="s">${r.s}${r.v ? " · " + money(r.v) + "/mo click value" : ""}</div><div class="t"><i data-w="${100 * r.c / mx}"></i></div></div>`).join("");
  setTimeout(() => document.querySelectorAll("#brk .t i").forEach(i => i.style.width = Math.max(1, +i.dataset.w) + "%"), 100);
  renderCtr();
}
function renderCtr() {
  const t = +$("#tRange").value; $("#tPos").textContent = "#" + t;
  $("#ctrBars").innerHTML = CTR.slice(1).map((c, j) => `<div><span>${(c * 100).toFixed(c < .02 ? 1 : 0)}%</span><i class="${j + 1 === t ? "on" : j + 1 < t ? "" : ""}" data-h="${100 * c / CTR[1]}" style="${j + 1 <= t ? "background:" + (j + 1 === t ? "" : "#3b3f73") : ""}"></i><em>#${j + 1}</em></div>`).join("");
  requestAnimationFrame(() => document.querySelectorAll("#ctrBars i").forEach(i => i.style.height = i.dataset.h + "%"));
  let g = 0, v = 0, n = 0;
  R.items.forEach(x => { const d = x.v * x.f * (ctr(t) - ctr(x.p)); if (d > 0) { g += d; v += d * (x.c || 0); n++; } });
  $("#tOut").innerHTML = `<div><b>+${fmt(g)}</b><span>visits / month</span></div>${v ? `<div><b>${money(v)}</b><span>click value / month</span></div>` : ""}<div><b>${fmt(n)}</b><span>searches improve</span></div>`;
}
$("#tRange").addEventListener("input", renderCtr);

/* ---------- local history (key mode) + share ---------- */
function shareSummary() {
  const S = SCAN, Rr = R, sc = scenarios(Rr).exp;
  const text = [`${S.domain} · ${S.keyword || "search visibility"} · ${S.location.label}`,
  `Today: ~${fmt(Rr.you.clicks)} visits/mo from this market (${(Rr.you.share * 100).toFixed(1)}% of clicks).`,
  `Market: ~${fmt(Rr.market.clicks)} organic clicks/mo across ${fmt(Rr.items.length)} searches${Rr.market.value ? `, worth ${money(Rr.market.value)} at ad prices` : ""}.`,
  `12-month projection: +${fmt(sc.gain)} visits/mo${sc.gainVal ? ` (${money(sc.gainVal)}/mo)` : ""}.`,
  `Leaders: ${Rr.comps.slice(0, 3).map(c => `${c.d} ${(c.share * 100).toFixed(1)}%`).join(", ")}.`].join("\n");
  if (navigator.share) navigator.share({ title: "Search traffic left on the table", text }).catch(() => { });
  else navigator.clipboard?.writeText(text).then(() => { $("#copyBtn").textContent = "Copied ✓"; setTimeout(() => $("#copyBtn").textContent = "Share", 1600); });
}

function renderLadder() {
  const Rr = R, sc = scenarios(Rr).exp, lead = Rr.comps.find(c => c.type === "direct") || Rr.comps[0];
  const bp = Rr.basis.local && Rr.market.clicks ? Math.max(.05, Rr.basis.clicks / Rr.market.clicks) : 1;
  const leadClicks = lead ? lead.clicks / bp : 0;
  const potential = Rr.you.clicks + Rr.table.clicks;
  const rows = [
    { l: "You today", s: SCAN.domain, v: Rr.you.clicks, val: Rr.you.value, c: "linear-gradient(90deg,#3ee98a,#7ef5b0)" },
    { l: "You in 12 months", s: "expected scenario", v: sc.months[12].clicks, val: sc.months[12].value, c: "linear-gradient(90deg,#e0a21f,#ffc13b)" },
    lead && { l: "The market leader", s: lead.d, v: leadClicks, val: lead.value / bp, c: "linear-gradient(90deg,#e0566a,#ff8a96)" },
    { l: "Top 3 on every search", s: "your full potential", v: potential, val: Rr.you.value + Rr.table.value, c: "repeating-linear-gradient(135deg,#ffc13b 0 8px,#e0a21f 8px 16px)" },
  ].filter(Boolean);
  const max = Math.max(...rows.map(r => r.v), 1);
  $("#ladder").innerHTML = rows.map(r => `<div class="lrow"><div class="lb">${r.l}<span>${esc(r.s)}</span></div><div class="tr2"><i style="background:${r.c}" data-w="${Math.max(0.6, 100 * r.v / max)}"></i></div><div class="vv">${fmt(r.v)}<span>${r.val ? money(r.val) + "/mo" : "visits/mo"}</span></div></div>`).join("");
  setTimeout(() => document.querySelectorAll("#ladder i").forEach((i, j) => setTimeout(() => i.style.width = i.dataset.w + "%", j * 250)), 200);
}

/* ---------- today vs. what you could be ---------- */
function simulate(Rr, posFn, packSet) {
  let clicks = 0, value = 0, kw3 = 0, kw10 = 0; const tClicks = {};
  Rr.items.forEach(x => {
    const p = posFn ? posFn(x) : x.p, pk = x.pk || (packSet && packSet.has(x.i));
    const c = x.v * (ctr(p) * x.f + (x.pk ? PACK[x.pk - 1] : pk ? PACK[2] : 0));
    clicks += c; value += c * (x.c || 0); if (p && p <= 3) kw3++; if (p && p <= 10) kw10++;
    tClicks[x.topic] = (tClicks[x.topic] || 0) + c;
  });
  const led = Rr.topics.filter(t => (tClicks[t.name] || 0) > (t.lead ? t.lead.clicks : 0) && (tClicks[t.name] || 0) > 0).length;
  const bp = Rr.basis.local && Rr.market.clicks ? Math.max(.05, Rr.basis.clicks / Rr.market.clicks) : 1;
  const rank = Rr.comps.filter(c => c.clicks / bp > clicks).length + 1;
  return { clicks, value, kw3, kw10, led, rank, share: Rr.market.clicks ? clicks / Rr.market.clicks : 0 };
}
function renderOverview() {
  const Rr = R, sc = scenarios(Rr).exp;
  const now = simulate(Rr), exp = simulate(Rr, sc.pos, sc.pk), full = simulate(Rr, x => (x.p && x.p <= 3) ? x.p : 2, new Set(Rr.items.filter(x => x.lp).map(x => x.i)));
  const cols = [
    { k: "now", t: "Today", s: SCAN.domain, c: "var(--green)", g: "62,233,138", d: now },
    { k: "exp", t: "In 12 months", s: "expected scenario", c: "var(--gold)", g: "255,193,59", d: exp },
    { k: "full", t: "Full potential", s: "top 3 on every search", c: "var(--pink)", g: "255,79,168", d: full },
  ];
  const nt = Rr.topics.length, nComp = Rr.comps.length + 1;
  const rows = [
    ["Visits / month", d => fmt(d.clicks), d => d.clicks, true],
    ["Share of the market", d => (d.share * 100).toFixed(d.share < .1 ? 1 : 0) + "%", d => d.share],
    ["Searches in the top 3", d => fmt(d.kw3), d => d.kw3],
    ["Searches on page one", d => fmt(d.kw10), d => d.kw10],
    ["Keyword groups you lead", d => `${d.led} of ${nt}`, d => d.led],
    ["Rank vs. competitors", d => d.rank > nComp - 1 ? "outside top " + (nComp - 1) : "#" + d.rank, d => 1 / d.rank],
    ["Click value / month", d => money(d.value), d => d.value],
  ];
  $("#ovr").innerHTML = `<div class="ovr-grid">${cols.map((c, j) => `<div class="ovc" style="--c:${c.c};--g:${c.g};animation-delay:${j * .15}s"><div class="ovh"><b>${c.t}</b><span>${esc(c.s)}</span></div>${rows.map(([l, f, v, big]) => {
    const mx = Math.max(...cols.map(q => v(q.d))) || 1;
    return `<div class="ovr-row ${big ? "big" : ""}"><span class="l">${l}</span><span class="v">${f(c.d)}</span><i data-w="${Math.max(2, 100 * v(c.d) / mx)}"></i></div>`;
  }).join("")}</div>`).join("")}</div>
  <div class="ovr-band"><div><b>${fmt(Math.max(0, exp.clicks - now.clicks))}</b><span>more visits a month within a year</span></div><div><b>+${fmt(Math.max(0, exp.kw10 - now.kw10))}</b><span>new page-one rankings</span></div><div><b>${fmt(Math.max(0, full.clicks - exp.clicks))}</b><span>more visits still open after that</span></div><div><b>${sc.months[12].clicks && now.clicks ? (sc.months[12].clicks / Math.max(1, now.clicks)).toFixed(1) + "×" : "+" + fmt(sc.gain)}</b><span>${now.clicks ? "today's traffic in 12 months" : "visits from a standing start"}</span></div></div>`;
  setTimeout(() => document.querySelectorAll("#ovr .ovr-row i").forEach(i => i.style.width = i.dataset.w + "%"), 200);
}

/* ---------- embed mode: the pitch deck tool runs a scan in a frame and gets this digest back ---------- */
let SCAN_ID = null;
function deckDigest() {
  const S = SCAN, Rr = R, SC = scenarios(Rr), sc = SC.exp;
  const now = simulate(Rr), exp = simulate(Rr, sc.pos, sc.pk);
  const r0 = x => Math.round(x || 0);
  const lead = Rr.comps.find(c => c.type === "direct") || Rr.comps[0];
  const bp = Rr.basis.local && Rr.market.clicks ? Math.max(.05, Rr.basis.clicks / Rr.market.clicks) : 1;
  return {
    scanId: SCAN_ID, domain: S.domain, keyword: S.keyword, note: S.note || "", date: S.date, location: S.location,
    ai: S.ai ? { biz: S.ai.biz, services: S.ai.services, audience: S.ai.audience, takeaway: S.ai.takeaway, moves: S.ai.moves, model: S.ai.model } : null,
    overview: S.overview, cost: +(S.cost || 0).toFixed(3), aiCost: +(S.aiCost || 0).toFixed(3),
    you: { visits: r0(Rr.you.clicks), value: r0(Rr.you.value), share: +Rr.you.share.toFixed(4), kw3: Rr.you.kw3, kw10: Rr.you.kw10, packs: Rr.you.packs, rank: Rr.you.rank },
    market: { visits: r0(Rr.market.clicks), value: r0(Rr.market.value), searches: Rr.items.length, volume: r0(Rr.searches) },
    missing: { visits: r0(Rr.missing.clicks), value: r0(Rr.missing.value) },
    notYours: { n: Rr.notYours.n, visits: r0(Rr.notYours.clicks), value: r0(Rr.notYours.value) },
    full: { visits: r0(Rr.table.clicks), value: r0(Rr.table.value) },
    striking: Rr.items.filter(x => x.p > 3 && x.p <= 20).length,
    untapped: Rr.items.filter(x => !x.p || x.p > 20).length,
    local: !!Rr.basis.local, mapPacks: (S.serps || []).filter(s => s.lp && s.lp.length).length, mapPacksYou: (S.serps || []).filter(s => s.youLp).length,
    serps: (S.serps || []).slice(0, 20).map(s => ({ k: s.k, you: s.you, ai: !!s.ai, lp: (s.lp || []).length > 0, youLp: !!s.youLp, top: s.org[0] ? s.org[0][0] : null })),
    aiOverviews: (S.serps || []).filter(s => s.ai).length,
    scenarios: Object.fromEntries(Object.entries(SC).map(([k, q]) => [k, { name: q.name, note: q.note, gain: r0(q.gain), gainVal: r0(q.gainVal), push: { n: q.push.n, visits: r0(q.push.clicks) }, win: { n: q.win.n, visits: r0(q.win.clicks) }, map: { n: q.map.n, visits: r0(q.map.clicks) }, months: q.months.map(m => r0(m.clicks)) }])),
    expected: { kw3: exp.kw3, kw10: exp.kw10, share: +exp.share.toFixed(4), rank: exp.rank },
    leader: lead ? { d: lead.d, visits: r0(lead.clicks / bp), share: +lead.share.toFixed(4), type: lead.type || null } : null,
    comps: Rr.comps.slice(0, 10).map(c => ({ d: c.d, visits: r0(c.clicks / bp), share: +c.share.toFixed(4), type: c.type || null, kw10: c.kw10, kw3: c.kw3, own: c.own, packs: c.packs })),
    topics: Rr.topics.slice(0, 12).map(t => ({ name: t.name, n: t.n, searches: r0(t.searches), visits: r0(t.clicks), yours: r0(t.yours), pot: r0(t.pot), potVal: r0(t.potVal), share: +t.share.toFixed(4), lead: t.lead ? t.lead.d : null, top: t.idx.map(i => Rr.items[i]).sort((a, b) => b.pot - a.pot).slice(0, 5).map(x => ({ k: x.k, v: x.v, p: x.p, pot: r0(x.pot) })) })),
    opportunities: Rr.items.filter(x => x.pot > 0).sort((a, b) => b.pot - a.pot).slice(0, 25).map(x => ({ k: x.k, v: x.v, p: x.p, d: x.d, c: x.c, pot: r0(x.pot), topic: x.topic })),
    strikingList: Rr.items.filter(x => x.p > 3 && x.p <= 20).sort((a, b) => b.pot - a.pot).slice(0, 15).map(x => ({ k: x.k, v: x.v, p: x.p, pot: r0(x.pot) })),
    rankedPages: [...new Set((S.ranked || []).filter(r => r.u).sort((a, b) => b.v - a.v).map(r => r.u))].slice(0, 30),
  };
}
function postDigest() {
  try { parent.postMessage({ type: "ot-scan", digest: deckDigest() }, location.origin); }
  catch (e) { console.error(e); parent.postMessage({ type: "ot-scan-error", error: "Couldn't summarise the scan: " + e.message }, location.origin); }
}
