import argparse
import asyncio
import logging
import os
import re

from dotenv import load_dotenv
from telegram import Bot

import classify
import db
import geo
from alerts import broadcast_job
from sources import (
    ats, apna, behance, dribbble, foundit, internshala, linkedin,
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
    remoteok, dribbble, telegram_web, telegram_source,
)

# India-native platforms: every listing is already India, so they bypass the geo city filter.
INDIA_NATIVE = {"telegram", "internshala", "foundit", "shine", "unstop", "apna"}


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
    seen_keys = set()  # cross-source de-dup on (title, company)
    for job in raw:
        # India-native platforms are already India-only; global sources must pass the geo check.
        if job.get("source") in INDIA_NATIVE:
            ok = True
        else:
            ok = geo.accepts_india(job.get("location"))
        if not ok:
            skipped_geo += 1
            continue
        discipline = classify.classify(job.get("title", ""), job.get("description", ""))
        if not discipline:
            continue
        company = (job.get("company") or "").strip().lower()
        if company:  # same role posted on multiple boards -> keep one
            key = (re.sub(r"\s+", " ", (job.get("title") or "").strip().lower()), company)
            if key in seen_keys:
                continue
            seen_keys.add(key)
        matched += 1
        job["discipline"] = discipline
        if db.save_job(job):
            fresh.append(job)
    log.info("non-India skipped: %d | design matches: %d | new: %d", skipped_geo, matched, len(fresh))
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
