"""Export the current jobs in the DB to web/public/jobs.json (the feed the web app reads)."""

import json
from datetime import datetime, timezone
from pathlib import Path

import db

OUT = Path(__file__).parent / "web" / "public" / "jobs.json"
FIELDS = ("id", "source", "discipline", "title", "company", "location",
          "url", "contact", "posted_at", "logo", "salary", "seen_at")


def main():
    rows = db.recent_jobs(limit=5000)
    jobs = []
    for r in rows:
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
    print(f"wrote {len(jobs)} jobs to {OUT}")


if __name__ == "__main__":
    main()
