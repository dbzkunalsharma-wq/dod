"""Creds-free Telegram channel source: scrapes the public t.me/s/<channel> web preview.

No api_id/api_hash and no login needed (unlike telegram_source.py, which uses Telethon
for full history). Returns RAW job dicts; the classifier assigns 'discipline' later.
Never raises: one bad channel is logged and skipped.

Public contract:
    fetch() -> list[dict]
"""

import logging

import httpx
from bs4 import BeautifulSoup

from sources.telegram_source import (
    _load_channels,
    extract_company,
    extract_contact,
    extract_url,
    first_meaningful_line,
    looks_like_job,
)

log = logging.getLogger("dod")

_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
_TIMEOUT = 15


def _to_job(channel: str, bubble) -> dict | None:
    text_el = bubble.select_one(".tgme_widget_message_text")
    if text_el is None:
        return None
    for br in text_el.find_all("br"):
        br.replace_with("\n")
    text = text_el.get_text().strip()
    if not looks_like_job(text):
        return None

    link_el = bubble.select_one("a.tgme_widget_message_date")
    permalink = link_el.get("href") if link_el else None
    msg_id = permalink.rstrip("/").rsplit("/", 1)[-1] if permalink else "?"

    time_el = bubble.select_one("time[datetime]")
    posted_at = time_el.get("datetime") if time_el else None

    return {
        "id": f"telegram:{channel}:{msg_id}",
        "source": "telegram",
        "title": first_meaningful_line(text),
        "company": extract_company(text),
        "location": None,
        "url": extract_url(text) or permalink,
        "contact": extract_contact(text),
        "posted_at": posted_at,
        "description": text,
    }


def _fetch_channel(channel: str) -> list[dict]:
    resp = httpx.get(
        f"https://t.me/s/{channel}", headers=_UA, timeout=_TIMEOUT, follow_redirects=True
    )
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    jobs = []
    for bubble in soup.select(".tgme_widget_message"):
        job = _to_job(channel, bubble)
        if job:
            jobs.append(job)
    return jobs


def fetch() -> list[dict]:
    """Scrape each configured public channel's web preview. Never raises."""
    jobs: list[dict] = []
    for channel in _load_channels():
        try:
            got = _fetch_channel(channel)
            log.info("telegram_web: %s -> %d job-like posts", channel, len(got))
            jobs.extend(got)
        except Exception as e:  # noqa: BLE001 - one bad channel must not kill the rest
            log.warning("telegram_web: skipping %s (%s)", channel, e)
    return jobs
