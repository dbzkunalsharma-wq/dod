"""Export the current jobs in the DB to web/public/jobs.json (the feed the web app reads)."""

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

# Mirror poll.py's freshness gate at export time: a job already sitting in the DB is
# dropped from the public feed once its posted_at is parseable AND older than this.
# (poll.py only blocks *new* stale inserts; this also evicts rows that aged past the
# window while in the DB.) Rows with a missing/garbled date are kept — we can't prove
# they're stale, and would rather show a maybe-old role than silently lose a fresh one.
MAX_AGE_DAYS = 55


def _parse_posted(value):
    """Best-effort parse of posted_at into an aware UTC datetime, or None (kept)."""
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


def _is_stale(value, now) -> bool:
    dt = _parse_posted(value)
    if dt is None:
        return False
    return (now - dt).days > MAX_AGE_DAYS


def _update_history(jobs, now) -> int:
    """Append today's per-source / per-discipline counts to stats-history.json
    (upserting if today already has an entry) so the web Insights page can show
    source health + volume over time. Keeps the last HISTORY_DAYS snapshots."""
    today = now.date().isoformat()
    entry = {
        "date": today,
        "total": len(jobs),
        "per_source": dict(Counter(j["source"] for j in jobs)),
        "per_discipline": dict(Counter(j["discipline"] for j in jobs)),
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


def main():
    rows = db.recent_jobs(limit=5000)
    now = datetime.now(timezone.utc)
    jobs = []
    dropped = 0
    for r in rows:
        if _is_stale(r.get("posted_at"), now):
            dropped += 1
            continue
        job = {k: r.get(k) for k in FIELDS}
        job["description"] = (r.get("description") or "").strip()[:1200]  # bound feed size
        jobs.append(job)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(jobs),
        "jobs": jobs,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    days = _update_history(jobs, now)
    print(f"wrote {len(jobs)} jobs to {OUT} (dropped {dropped} stale >{MAX_AGE_DAYS}d); "
          f"stats-history now {days} day(s)")


if __name__ == "__main__":
    main()
