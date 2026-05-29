"""RemoteOK remote-design source via its public JSON API (https://remoteok.com/api).

Global remote roles; the India filter (geo.accepts_india) keeps the worldwide/India-open
ones. No auth. Returns RAW job dicts; the classifier assigns 'discipline' later. Never raises.

Public contract:
    fetch() -> list[dict]
"""

import logging

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger("dod")

_API = "https://remoteok.com/api"
_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
_DESIGN_HINTS = ("design", "ux", "ui", "graphic", "motion", "brand")


def _strip(html_text) -> str:
    if not html_text:
        return ""
    return BeautifulSoup(str(html_text), "html.parser").get_text(" ", strip=True)


def _to_job(item) -> dict | None:
    position = item.get("position")
    if not position:
        return None
    tags = [str(t).lower() for t in (item.get("tags") or [])]
    blob = (position + " " + " ".join(tags)).lower()
    if not any(h in blob for h in _DESIGN_HINTS):  # pre-filter; classifier makes the final call
        return None
    return {
        "id": f"remoteok:{item.get('id')}",
        "source": "remoteok",
        "title": position,
        "company": item.get("company"),
        "location": item.get("location") or "Remote",
        "url": item.get("url") or item.get("apply_url"),
        "contact": None,
        "posted_at": (item.get("date") or "")[:10] or None,
        "description": f"{position} {_strip(item.get('description'))} {' '.join(tags)}",
    }


def fetch() -> list[dict]:
    try:
        resp = httpx.get(_API, headers=_UA, timeout=20)
        arr = resp.json() if resp.status_code == 200 else []
    except Exception as e:  # noqa: BLE001
        log.warning("remoteok: fetch failed (%s)", e)
        return []
    jobs = []
    for item in arr:
        if not isinstance(item, dict) or "position" not in item:  # arr[0] is metadata
            continue
        job = _to_job(item)
        if job:
            jobs.append(job)
    log.info("remoteok: %d design postings", len(jobs))
    return jobs
