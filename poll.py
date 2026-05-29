import argparse
import asyncio
import logging
import os
import re
from datetime import datetime, timezone

from dotenv import load_dotenv
from telegram import Bot

import classify
import db
import geo
from alerts import broadcast_job
from sources import (
    ats, apna, behance, dribbble, foundit, freshersworld, internshala, linkedin,
    remoteok, shine, telegram_source, telegram_web, unstop,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
log = logging.getLogger("dod.poll")

# telegram_web scrapes public channels via t.me/s/ (no creds). telegram_source is the
# Telethon upgrade (full history) once api creds are set; same job ids, so dedup covers overlap.
SOURCES = (
    ats, linkedin, unstop, internshala, foundit, shine, apna, behance,
    remoteok, dribbble, freshersworld, telegram_web, telegram_source,
)

# India-native platforms: every listing is already India, so they bypass the geo city filter.
INDIA_NATIVE = {"telegram", "internshala", "foundit", "shine", "unstop", "apna", "freshersworld"}

# Freshness gate: drop postings whose posted_at parses to older than this. Jobs with a
# missing or unparseable date are KEPT (many boards omit/garble dates and we'd rather show
# a possibly-stale role than silently lose a fresh one).
MAX_AGE_DAYS = 55

# Seniority / qualifier words stripped when building the cross-source (title, company)
# dedup key, so "Senior Product Designer" and "Product Designer" at the same company
# collapse to one. Deliberately NOT including discipline words (graphic/ux/visual/...),
# which distinguish genuinely different roles.
_SENIORITY = re.compile(
    r"\b(senior|sr|junior|jr|lead|principal|staff|associate|assistant|trainee|intern|"
    r"internship|fresher|entry[- ]level|mid[- ]level|i{1,3}|iv|v|grade|level)\b",
    re.IGNORECASE,
)


def _parse_posted(value):
    """Best-effort parse of a posting's posted_at into an aware UTC datetime, or None.

    Sources hand us ISO dates ("2026-04-17"), full ISO timestamps (with a trailing Z or an
    offset) or None. We normalise the trailing Z, parse with fromisoformat, and treat a
    naive result as UTC. Anything we can't parse returns None so the caller keeps the job.
    """
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        # Fall back to a bare date prefix (e.g. "2026-04-17T..." that isoformat rejected).
        try:
            dt = datetime.strptime(text[:10], "%Y-%m-%d")
        except (ValueError, IndexError):
            return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _is_stale(value, now=None, max_age_days=MAX_AGE_DAYS) -> bool:
    """True only when posted_at is present AND parseable AND older than max_age_days.
    Missing/unparseable dates are never stale (we keep them)."""
    dt = _parse_posted(value)
    if dt is None:
        return False
    now = now or datetime.now(timezone.utc)
    return (now - dt).days > max_age_days


def _dedup_key(title, company):
    """Normalised (title, company) key for cross-source de-dup: lowercase, drop seniority
    qualifiers and punctuation, collapse whitespace. Returns None when company is blank
    (we only dedup rows that name a company)."""
    comp = re.sub(r"\s+", " ", (company or "").strip().lower())
    if not comp:
        return None
    t = (title or "").lower()
    t = _SENIORITY.sub(" ", t)
    t = re.sub(r"[^a-z0-9 ]+", " ", t)   # strip punctuation/symbols
    t = re.sub(r"\s+", " ", t).strip()
    return (t, comp)


def collect_and_save():
    """Fetch every source, classify, persist. Returns the newly-seen design jobs."""
    db.init()
    raw = []
    for src in SOURCES:
        name = src.__name__.split(".")[-1]
        try:
            jobs = src.fetch()
            log.info("%s: %d postings", name, len(jobs))
            raw.extend(jobs)
        except Exception:
            log.exception("source failed: %s", name)

    fresh = []
    matched = 0
    skipped_geo = 0
    skipped_stale = 0
    now = datetime.now(timezone.utc)
    seen_keys = set()  # cross-source de-dup on normalised (title, company)
    for job in raw:
        # India-native platforms are already India-only; global sources must pass the geo check.
        if job.get("source") in INDIA_NATIVE:
            ok = True
        else:
            ok = geo.accepts_india(job.get("location"))
        if not ok:
            skipped_geo += 1
            continue
        # Drop clearly-stale postings (dated AND older than the freshness window); rows with
        # no/garbled date are kept.
        if _is_stale(job.get("posted_at"), now=now):
            skipped_stale += 1
            continue
        discipline = classify.classify(job.get("title", ""), job.get("description", ""))
        if not discipline:
            continue
        key = _dedup_key(job.get("title"), job.get("company"))
        if key is not None:  # same role posted on multiple boards -> keep one
            if key in seen_keys:
                continue
            seen_keys.add(key)
        matched += 1
        job["discipline"] = discipline
        if db.save_job(job):
            fresh.append(job)
    log.info("non-India skipped: %d | stale (>%dd) skipped: %d | design matches: %d | new: %d",
             skipped_geo, MAX_AGE_DAYS, skipped_stale, matched, len(fresh))
    return fresh


async def broadcast_all(jobs):
    token = os.environ.get("BOT_TOKEN")
    if not token:
        log.warning("BOT_TOKEN missing; skipping broadcast")
        return 0
    sent = 0
    async with Bot(token) as bot:
        for job in jobs:
            sent += await broadcast_job(bot, job)
    return sent


def main():
    parser = argparse.ArgumentParser(
        description="DOD poller: fetch -> classify -> dedup -> alert subscribers"
    )
    parser.add_argument(
        "--seed",
        action="store_true",
        help="save current jobs as a baseline WITHOUT sending alerts (use on the first run)",
    )
    args = parser.parse_args()

    fresh = collect_and_save()
    sent = 0
    if args.seed:
        log.info("seed mode: %d jobs saved as baseline, no alerts sent", len(fresh))
    elif fresh:
        sent = asyncio.run(broadcast_all(fresh))
    log.info("done | new: %d | alerts sent: %d", len(fresh), sent)


if __name__ == "__main__":
    main()
