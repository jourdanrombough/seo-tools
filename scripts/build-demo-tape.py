#!/usr/bin/env python3
"""Turn a recorded run (dev-server.py --record demo-tape.jsonl) into tools/demo/tape.json for demo mode."""
import json, sys
src = sys.argv[1] if len(sys.argv) > 1 else "demo-tape.jsonl"
rows = [json.loads(l) for l in open(src)]
calls = [r for r in rows if r["a"] in ("dfs", "ai")]
saves = [r for r in rows if r["a"] == "save"]
scan = [json.loads(r["body"])["data"] for r in saves if r["name"] == "scans"][-1]
deck = [json.loads(r["body"])["data"] for r in saves if r["name"] == "decks"][-1]
deck["status"] = "sample"
crawl_n = next((json.loads(c["body"])["task"].get("max_crawl_pages") for c in calls if c["name"] == "on_page/task_post"), 100)
tape = {"recorded": deck["created"], "crawlN": crawl_n, "rates": None, "scan": scan, "deck": deck,
        "calls": [{"a": c["a"], "name": c["name"], "body": c["body"], "res": c["res"]} for c in calls]}
s = json.dumps(tape, separators=(",", ":"))
open("tools/demo/tape.json", "w").write(s)
print(f"{len(calls)} calls, {len(s):,} bytes")
