"""Export jobs to web/public/jobs.json (the feed the web app reads).

This UNIONS the previously-published feed with the current DB rows, keyed by job id, so
each daily run ADDS to the live feed rather than replacing it. That makes the feed robust
to a throttled cloud scrape: if today's poll only landed a fraction of the usual roles
(e.g. LinkedIn 429s), yesterday's still-fresh roles are carried forward instead of
vanishing. Stale roles are then evicted by date so the union can't grow without bound.

poll.py still seeds the DB from the current scrape; this module does the union against the
prior published JSON. db.recent_jobs is the authority for any id present in both.
"""

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import db

OUT = Path(__file__).parent / "web" / "public" / "jobs.json"
HIST = Path(__file__).parent / "web" / "public" / "stats-history.json"
FIELDS = ("id", "source", "discipline", "title", "company", "location",
          "url", "contact", "posted_at", "logo", "salary", "seen_at")

# Keep ~4 months of daily snapshots for the Insights source-health view.
HISTORY_DAYS = 120

# Freshness gate at export time. A job leaves the public feed once it is provably stale:
#   * posted_at present AND parseable AND older than MAX_AGE_DAYS, OR
#   * posted_at absent/garbled BUT seen_at parseable AND older than MAX_SEEN_AGE_DAYS.
# A row with neither a usable posted_at nor a usable seen_at is KEPT — we can't prove it's
# stale, and would rather show a maybe-old role than silently lose a fresh one. The
# seen_at rule is what bounds the rolling union: a carried-forward row we've not re-seen
# in ~2 months finally ages out.
MAX_AGE_DAYS = 55
MAX_SEEN_AGE_DAYS = 60


def _parse_posted(value):
    """Best-effort parse of an ISO date/timestamp into an aware UTC datetime, or None."""
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        try:
            dt = datetime.strptime(text[:10], "%Y-%m-%d")
        except (ValueError, IndexError):
            return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _is_stale(job, now) -> bool:
    """True only when a job is PROVABLY stale (see the freshness-gate note above)."""
    posted = _parse_posted(job.get("posted_at"))
    if posted is not None:
        return (now - posted).days > MAX_AGE_DAYS
    seen = _parse_posted(job.get("seen_at"))
    if seen is not None:
        return (now - seen).days > MAX_SEEN_AGE_DAYS
    return False


def _load_prior_jobs() -> list[dict]:
    """The jobs[] array from the previously-published feed, or [] when absent/garbled.
    Never raises: a missing or malformed prior feed just means 'no carry-forward'."""
    try:
        payload = json.loads(OUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError, OSError):
        return []
    jobs = payload.get("jobs") if isinstance(payload, dict) else None
    return [j for j in jobs if isinstance(j, dict) and j.get("id")] if isinstance(jobs, list) else []


def _update_history(jobs, now) -> int:
    """Append today's per-source / per-discipline counts to stats-history.json
    (upserting if today already has an entry) so the web Insights page can show
    source health + volume over time. Keeps the last HISTORY_DAYS snapshots."""
    today = now.date().isoformat()
    entry = {
        "date": today,
        "total": len(jobs),
        "per_source": dict(Counter(j.get("source") for j in jobs if j.get("source"))),
        "per_discipline": dict(Counter(j.get("discipline") for j in jobs if j.get("discipline"))),
    }
    try:
        hist = json.loads(HIST.read_text(encoding="utf-8"))
        if not isinstance(hist, list):
            hist = []
    except (FileNotFoundError, ValueError):
        hist = []
    hist = [h for h in hist if h.get("date") != today]  # upsert today's snapshot
    hist.append(entry)
    hist.sort(key=lambda h: h.get("date", ""))
    hist = hist[-HISTORY_DAYS:]
    HIST.write_text(json.dumps(hist, ensure_ascii=False), encoding="utf-8")
    return len(hist)


def _project(row) -> dict:
    """Project a job (DB row or prior-feed dict) onto the export shape, bounding the
    description so the feed stays small. Prior rows are already trimmed; re-trimming is
    idempotent and harmless."""
    job = {k: row.get(k) for k in FIELDS}
    job["description"] = (row.get("description") or "").strip()[:1200]
    return job


def main():
    now = datetime.now(timezone.utc)

    # Start from the previously-published feed, then let the current DB scrape overwrite
    # any id it also carries (the live DB is the authority for a re-seen role).
    merged: dict[str, dict] = {}
    prior = _load_prior_jobs()
    for j in prior:
        merged[j["id"]] = _project(j)
    prior_count = len(merged)

    rows = db.recent_jobs(limit=5000)
    current_count = 0
    for r in rows:
        rid = r.get("id")
        if not rid:
            continue
        merged[rid] = _project(r)
        current_count += 1

    # Evict provably-stale rows from the union (this is what bounds its growth).
    jobs = []
    dropped = 0
    for job in merged.values():
        if _is_stale(job, now):
            dropped += 1
            continue
        jobs.append(job)

    payload = {
        "generated_at": now.isoformat(timespec="seconds"),
        "count": len(jobs),
        "jobs": jobs,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    days = _update_history(jobs, now)
    print(f"prior {prior_count} + current {current_count} -> union {len(merged)}; "
          f"wrote {len(jobs)} jobs to {OUT} (dropped {dropped} stale: "
          f"posted>{MAX_AGE_DAYS}d or unseen>{MAX_SEEN_AGE_DAYS}d); "
          f"stats-history now {days} day(s)")


if __name__ == "__main__":
    main()
