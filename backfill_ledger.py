"""One-time backfill: seed the company ledger from the GIT HISTORY of
web/public/jobs.json, so it starts deeper than just today's feed.

Every past commit of jobs.json is a snapshot of who was hiring that day. We walk
them oldest->newest, union every company into companies-ledger.json with an
accurate first_seen / last_seen, then MX-verify any newly-discovered company's
domain (reusing ledger.py's verifier). Companies that appear only in history (not
in today's feed) are added as dormant (open_roles = 0) — still valid outreach
targets. Idempotent: re-running only back-dates first_seen / adds missing ones.

Run from the repo root AFTER ledger.py has seeded today's companies.
"""

import asyncio
import json
import logging
import subprocess
from collections import Counter
from pathlib import Path

import ledger as L  # reuse _norm_key, _domain_candidates, _clean_contacts, _verify, LEDGER

log = logging.getLogger("dod.backfill")
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")

REPO = Path(__file__).parent
REL = "web/public/jobs.json"


def _git(*args) -> str:
    return subprocess.run(
        ["git", "-C", str(REPO), *args],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    ).stdout


def _snapshots():
    """Yield (date, jobs[]) for each commit of jobs.json, oldest first."""
    out = _git("log", "--format=%H\t%cI", "--", REL)
    rows = [ln.split("\t") for ln in out.splitlines() if "\t" in ln]
    rows.reverse()  # oldest -> newest
    for h, ciso in rows:
        blob = _git("show", f"{h}:{REL}")
        if not blob.strip():
            continue
        try:
            feed = json.loads(blob)
        except ValueError:
            continue
        date = (feed.get("generated_at") or ciso or "")[:10]
        jobs = feed.get("jobs", [])
        if date and jobs:
            yield date, jobs


def main():
    # Accumulate per-company history across all snapshots.
    hist: dict[str, dict] = {}
    snaps = 0
    for date, jobs in _snapshots():
        snaps += 1
        for j in jobs:
            comp = (j.get("company") or "").strip()
            if not comp:
                continue
            key = L._norm_key(comp)
            if not key:
                continue
            h = hist.setdefault(key, {
                "names": Counter(), "disciplines": set(), "locations": set(),
                "logos": [], "jobs": [], "first": date, "last": date,
            })
            h["names"][comp] += 1
            if j.get("discipline"):
                h["disciplines"].add(j["discipline"])
            if j.get("location"):
                h["locations"].add(j["location"])
            if j.get("logo"):
                h["logos"].append(j["logo"])
            h["jobs"].append(j)
            h["first"] = min(h["first"], date)
            h["last"] = max(h["last"], date)
    log.info("scanned %d jobs.json snapshots -> %d distinct companies in history", snaps, len(hist))

    ledger = json.loads(L.LEDGER.read_text(encoding="utf-8")) if L.LEDGER.exists() else {}

    to_check: dict[str, list[str]] = {}
    new_keys = 0
    for key, h in hist.items():
        name = h["names"].most_common(1)[0][0]
        logo = h["logos"][0] if h["logos"] else None
        emails, phones = L._clean_contacts(h["jobs"])
        prev = ledger.get(key)
        if prev is None:
            new_keys += 1
            ledger[key] = {
                "name": name,
                "first_seen": h["first"],
                "last_seen": h["last"],
                "days_seen": 1,
                "open_roles": 0,  # history-only -> dormant unless today's run set it
                "disciplines": sorted(h["disciplines"]),
                "locations": sorted(h["locations"]),
                "logo": logo,
                "posted_emails": emails,
                "posted_phones": phones,
            }
            to_check[key] = L._domain_candidates(name, logo)
        else:
            # back-date / widen the existing entry from history; keep today's open_roles + domain
            prev["first_seen"] = min(prev.get("first_seen", h["first"]), h["first"])
            prev["last_seen"] = max(prev.get("last_seen", h["last"]), h["last"])
            prev["disciplines"] = sorted(set(prev.get("disciplines", [])) | h["disciplines"])
            prev["locations"] = sorted(set(prev.get("locations", [])) | h["locations"])
            prev["posted_emails"] = sorted(set(prev.get("posted_emails", [])) | set(emails))[:6]
            prev["posted_phones"] = sorted(set(prev.get("posted_phones", [])) | set(phones))[:6]
            if logo and not prev.get("logo"):
                prev["logo"] = logo
            if not prev.get("domain") and not prev.get("verified_on"):
                to_check[key] = L._domain_candidates(name, logo)

    verified = asyncio.run(L._verify(to_check)) if to_check else {}
    today = max((h["last"] for h in hist.values()), default="")
    for key, dom in verified.items():
        ledger[key]["domain"] = dom
        ledger[key]["verified_on"] = today or ledger[key].get("last_seen")

    L.LEDGER.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")
    with_dom = sum(1 for e in ledger.values() if e.get("domain"))
    log.info("ledger after backfill: %d companies (+%d from history) | %d MX-verified domains",
             len(ledger), new_keys, with_dom)


if __name__ == "__main__":
    main()
