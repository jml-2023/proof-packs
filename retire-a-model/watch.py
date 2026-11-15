#!/usr/bin/env python3
"""Retirement watch: checks the models your work depends on against OpenRouter's public model list, keeps a dated
copy, and says what changed since the last copy. No key is needed.

    python3 -I watch.py models.json watch/

For each model it reports whether it is still listed, any expiry date OpenRouter has set, its list price and any
change since the last run, and every host that serves it, with that host's price and status. A model that is not on
OpenRouter (a voice, for instance) is listed as one to check by hand.

It can't see a name that a provider has pointed at a newer model: the list keeps the old name, date and price. So it
ends with the providers' own deprecation pages, to read by hand, and a reminder to run trial.py on anything that
changed.
"""
import datetime
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

LIST = "https://openrouter.ai/api/v1/models"
ENDPOINTS = "https://openrouter.ai/api/v1/models/{}/endpoints"
PRICES = ("prompt", "completion", "audio")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "retire-a-model/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def per_million(v):
    try:
        return round(float(v) * 1_000_000, 4)
    except (TypeError, ValueError):
        return None


def snapshot(models):
    listed = {m["id"]: m for m in get(LIST)["data"]}
    snap = {"taken": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "models": {},
            "expiring_anywhere": sorted([{"id": m["id"], "expires": m["expiration_date"]} for m in listed.values()
                                         if m.get("expiration_date")], key=lambda x: x["expires"])}
    for item in models:
        mid = item["id"]
        if item.get("route", "openrouter") != "openrouter":
            snap["models"][mid] = {"listed": None, "route": item["route"]}
            continue
        m = listed.get(mid)
        if not m:
            snap["models"][mid] = {"listed": False}
            continue
        entry = {"listed": True, "canonical": m.get("canonical_slug"), "expires": m.get("expiration_date"),
                 "price_per_million": {k: per_million(m.get("pricing", {}).get(k)) for k in PRICES}, "hosts": []}
        try:
            for e in get(ENDPOINTS.format(urllib.parse.quote(mid, safe="/~")))["data"]["endpoints"]:
                entry["hosts"].append({"host": e.get("tag") or e.get("provider_name"), "status": e.get("status"),
                                       "uptime_30m": e.get("uptime_last_30m"),
                                       "price_per_million": {k: per_million((e.get("pricing") or {}).get(k)) for k in PRICES}})
        except OSError as err:
            entry["hosts_error"] = str(err)
        snap["models"][mid] = entry
    return snap


def compare(old, new):
    notes = []
    for mid, n in new["models"].items():
        o = (old or {}).get("models", {}).get(mid)
        if n.get("listed") is False:
            notes.append(f"{mid}: GONE from OpenRouter's list" + (" (it was there last time)" if o and o.get("listed") else ""))
            continue
        if n.get("listed") is None:
            notes.append(f"{mid}: not on OpenRouter ({n['route']}); check its provider by hand")
            continue
        if n.get("expires"):
            notes.append(f"{mid}: EXPIRES {n['expires']}")
        if not o or not o.get("listed"):
            continue
        for k in PRICES:
            a, b = o["price_per_million"].get(k), n["price_per_million"].get(k)
            if a != b:
                notes.append(f"{mid}: {k} price ${a} -> ${b} per million tokens")
        if o.get("canonical") != n.get("canonical"):
            notes.append(f"{mid}: now points at {n.get('canonical')} (was {o.get('canonical')})")
        before = {h["host"] for h in o.get("hosts", [])}
        after = {h["host"] for h in n.get("hosts", [])}
        for h in sorted(after - before):
            notes.append(f"{mid}: new host {h}")
        for h in sorted(before - after):
            notes.append(f"{mid}: host gone {h}")
    return notes


def main():
    config = json.loads(Path(sys.argv[1]).read_text())
    folder = Path(sys.argv[2] if len(sys.argv) > 2 else "watch")
    folder.mkdir(parents=True, exist_ok=True)
    earlier = sorted(folder.glob("*.json"))
    old = json.loads(earlier[-1].read_text()) if earlier else None
    new = snapshot(config["models"])
    stamp = new["taken"][:16].replace(":", "")
    (folder / f"{stamp}.json").write_text(json.dumps(new, indent=1) + "\n")

    print(f"Retirement watch, {new['taken']}" + (f", compared with {earlier[-1].name}" if earlier else ", first run"))
    for item in config["models"]:
        n = new["models"][item["id"]]
        if n.get("listed"):
            hosts = ", ".join(f"{h['host']} ${h['price_per_million'].get('prompt')}" + ("" if h["status"] == 0 else f" (status {h['status']})")
                              for h in n["hosts"])
            print(f"- {item['id']} ({item.get('step', '')}): list ${n['price_per_million'].get('prompt')} per million input tokens;"
                  f" expires {n['expires'] or 'not set'}; {len(n['hosts'])} host{'' if len(n['hosts']) == 1 else 's'}: {hosts}")
        else:
            print(f"- {item['id']} ({item.get('step', '')}): " + ("not on OpenRouter's list" if n.get("listed") is False else f"via {n['route']}"))
    notes = compare(old, new)
    print("\nChanged or needs a look:" if notes else "\nNothing changed since the last run.")
    for line in notes:
        print(f"  {line}")
    print(f"\nModels on OpenRouter with an expiry date set today: {len(new['expiring_anywhere'])}")
    for e in new["expiring_anywhere"][:20]:
        print(f"  {e['expires']}  {e['id']}")
    print("\nRead by hand, because a provider that points an old name at a newer model says so only on its own page, and each host"
          " can give the same name a different date:")
    for name, url in config.get("pages", {}).items():
        print(f"  {name}: {url}")
    print("\nFor anything above that changed, run trial.py on your own cases before you trust the model again.")


if __name__ == "__main__":
    main()
