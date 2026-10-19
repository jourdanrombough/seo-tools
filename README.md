# Optimization Theory SEO tools

### ▶ [Try the live demo](https://jourdanrombough.github.io/seo-tools/tools/demo/)

A real run on vuss.io, replayed through the real tools: traffic gap scan, site crawl, AI search check, a 90-day plan priced from a rate card, and the finished pitch deck (link, PowerPoint and PDF). The demo calls no API.

Two live microsites for optimizationtheory.com, sharing one small PHP backend:

| Tool | Address | What it does |
| --- | --- | --- |
| Traffic Gap Scanner | `/tools/traffic-gap/` | Domain, optional keyword and an optional note to the AI in. About a minute later: visits today, visits going to competitors, a 12-month projection, the keyword universe and who owns it. |
| Pitch Deck Generator | `/tools/pitch-deck/` | Runs the scan, crawls the site with DataForSEO's On-Page crawler (or reads your Screaming Frog / Sitebulb export), checks link authority, asks ChatGPT and Google AI Overviews about the market, builds a 90-day plan priced from your rate card, and writes a 12-slide deck. Share it as a private link, a PowerPoint or a PDF. |

Data comes from DataForSEO. The AI work runs on the Claude API (Haiku for keyword checks, Sonnet for the plan and the deck copy), with Claude through DataForSEO as the backup. Keys stay on the server; the browser never sees them.

## Put it on optimizationtheory.com

1. **Add three lines to `wp-config.php`**, above `/* That's all, stop editing! */`:

   ```php
   define('DATAFORSEO_LOGIN', 'your DataForSEO login');
   define('DATAFORSEO_PASSWORD', 'your DataForSEO API password');
   define('ANTHROPIC_API_KEY', 'your Claude API key');
   ```

2. **Upload** `seo-tools-upload.zip` to the site root (the folder with `wp-config.php`) and unzip it. You get `/tools/` with `_core`, `traffic-gap` and `pitch-deck` inside. In cPanel: File Manager, Upload, then Extract.

3. **Make `/tools/` writable** for PHP. The first live request creates `/tools/_data/` for saved scans, decks, the cache and logs. If your host complains, create `tools/_data` yourself with permissions 750 or 755.

4. **Log in to WordPress as an administrator**, then open:
   - `https://optimizationtheory.com/tools/traffic-gap/`
   - `https://optimizationtheory.com/tools/pitch-deck/`
   - `https://optimizationtheory.com/tools/pitch-deck/settings/` to check your rate card

   Logged out, the scanner only replays its examples and the deck tool asks you to log in. Prospects open published decks at `/tools/pitch-deck/p/?id=...` with no login.

**If something blocks it:** some security plugins (Wordfence, iThemes, Sucuri) block PHP files outside WordPress. Allow `/tools/*/api.php` and `/tools/pitch-deck/p/index.php`. PHP 7.4 or newer with cURL is all it needs.

## Demo for showing companies

`/tools/demo/` is a public demo that needs no login and calls no API. It replays a real recorded run on vuss.io through the real tools: the scan animation, the crawl, the AI checks, the plan, the deck editor, the private link, the PowerPoint and the PDF.

- Landing page: `/tools/demo/`
- Pitch deck demo: `/tools/pitch-deck/?demo=1`
- Finished deck: `/tools/pitch-deck/p/viewer.html?demo=1`
- Scanner demo: `/tools/traffic-gap/?demo=1`

The recording is `tools/demo/tape.json`. To record a new one, run `python3 dev-server.py --record demo-tape.jsonl`, build a deck, then `python3 scripts/build-demo-tape.py demo-tape.jsonl`.

## Limits and costs

Set in `tools/_core/config.php`:

- Daily spend caps: $10 of DataForSEO and $3 of Claude, checked before every call.
- Models: `claude-haiku-5-5` (fast) and `claude-sonnet-5-5` (smart). Change one line to upgrade.
- Every call's cost and time is logged in `tools/_data/logs/`.

Typical cost per run:

| Run | DataForSEO | Claude | Time |
| --- | --- | --- | --- |
| Scan, nationwide | about $0.30 | about $0.02 | 45 to 60 s |
| Scan with a state | about $0.55 | about $0.03 | 60 to 90 s |
| Pitch deck (includes a scan and a 100-page crawl) | about $0.75 to $0.90 | about $0.10 to $0.15 | 2 to 3 min |

Re-running anything within 7 days is free (cached). Reusing a saved scan in the deck tool skips the scan cost.

## Run it on your Mac (no PHP needed)

```bash
python3 dev-server.py            # reads ~/DataForSEO/.env, opens http://localhost:8777/tools/
```

Or double-click `Start SEO Tools.command`. `.env` needs `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` and `ANTHROPIC_API_KEY`.

## How it fits together

```
phone/laptop ──▶ tools/<tool>/api.php ──▶ tools/_core/router.php
                                            ├─ auth.php    WordPress admin check + nonce
                                            ├─ dfs.php     DataForSEO allowlist, cache, spend cap, log
                                            ├─ claude.php  named prompts (prompts.json), JSON answers, retry
                                            └─ store.php   scans, decks, rate card, public deck links
```

- One outside API call per request, so nothing hits PHP's 30-second limit. The browser runs the steps in order and draws the animation between them.
- The browser sends an AI task name plus data. The prompts live in `tools/_core/prompts.json` on the server, so nobody can use the key as a chatbot.
- Prices are calculated in code from the rate card. Claude picks and orders the work items and writes the words, never the numbers.
- Saved files are `.json.php` files that exit when requested directly, so they stay private even on servers that ignore `.htaccess`.

## Files

```
tools/
  index.html              landing page for both tools
  _core/                  shared backend (config, auth, DataForSEO, Claude, storage, prompts)
  traffic-gap/            scanner: index.html, app.js, api.php, examples/
  pitch-deck/             deck tool: index.html, app.js, deck.js (slides + PowerPoint), deck.css,
                          crawl.js (Screaming Frog / Sitebulb reader), rates.js (default rate card),
                          settings/ (rate card editor), p/ (public deck viewer), api.php
dev-server.py             the same API in Python for your Mac
```
