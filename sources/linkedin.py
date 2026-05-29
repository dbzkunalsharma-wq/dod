"""LinkedIn India design-jobs source via the PUBLIC guest endpoint.

Uses https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search — the
same endpoint LinkedIn serves to logged-out visitors for its public job widget. No
login, no captcha. Returns RAW job dicts; the classifier assigns 'discipline' later.
Never raises: a failed query is logged and skipped.

Public contract:
    fetch() -> list[dict]
"""

import logging
import time

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger("dod")

_BASE = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
_UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

# Design-discipline queries; the classifier still makes the final call per result.
_QUERIES = [
    "UI UX Designer", "Product Designer", "Graphic Designer", "Visual Designer",
    "Motion Designer", "Interaction Designer", "UX Researcher",
    "Industrial Designer", "Communication Designer", "Brand Designer",
]
_LOCATION = "India"
_STARTS = (0, 10, 20, 30)  # four pages (~40 results) per query
_DELAY = 1.2             # seconds between requests, to stay polite / avoid throttling


def _to_job(card) -> dict | None:
    title_el = card.select_one(".base-search-card__title")
    if title_el is None:
        return None
    title = title_el.get_text(strip=True)

    comp_el = card.select_one(".base-search-card__subtitle")
    loc_el = card.select_one(".job-search-card__location")
    link_el = card.select_one("a.base-card__full-link") or card.select_one("a[href*='/jobs/view/']")
    time_el = card.select_one("time")

    url = link_el.get("href").split("?")[0] if link_el and link_el.get("href") else None
    urn = card.get("data-entity-urn") or ""
    job_id = urn.rsplit(":", 1)[-1] if urn else (url.rstrip("/").rsplit("-", 1)[-1] if url else None)
    if not job_id:
        return None

    company = comp_el.get_text(strip=True) if comp_el else None
    location = loc_el.get_text(strip=True) if loc_el else None

    # Company-logo <img> in the guest card. The src is lazy-loaded (often empty), so the
    # real URL usually lives in data-delayed-url; fall back to src when present.
    logo_el = card.select_one("img.artdeco-entity-image") or card.select_one(
        ".search-entity-media img, .base-search-card__info img"
    )
    logo = None
    if logo_el is not None:
        cand = logo_el.get("data-delayed-url") or logo_el.get("src")
        if isinstance(cand, str) and cand.startswith("http"):
            logo = cand

    # Guest cards almost never expose pay, but a few surface a
    # `.job-search-card__salary-info` chip; use it when present, else None.
    sal_el = card.select_one(".job-search-card__salary-info")
    salary = None
    if sal_el is not None:
        raw = sal_el.get_text(" ", strip=True)
        salary = " ".join(raw.split()) or None

    return {
        "id": f"linkedin:{job_id}",
        "source": "linkedin",
        "title": title,
        "company": company,
        "location": location,
        "url": url,
        "logo": logo,
        "contact": None,
        "posted_at": time_el.get("datetime") if time_el else None,
        "salary": salary,
        "description": f"{title} {company or ''}",
    }


def fetch() -> list[dict]:
    """Query each design discipline for India roles via the guest endpoint. Never raises."""
    jobs: list[dict] = []
    seen: set[str] = set()
    for query in _QUERIES:
        for start in _STARTS:
            try:
                resp = httpx.get(
                    _BASE,
                    params={"keywords": query, "location": _LOCATION, "start": start},
                    headers=_UA,
                    timeout=20,
                )
                if resp.status_code != 200:
                    log.warning("linkedin: '%s' start=%s -> HTTP %s", query, start, resp.status_code)
                    break
                cards = BeautifulSoup(resp.text, "html.parser").select("div.base-card")
                if not cards:
                    break
                for card in cards:
                    job = _to_job(card)
                    if job and job["id"] not in seen:
                        seen.add(job["id"])
                        jobs.append(job)
            except Exception as e:  # noqa: BLE001 - one bad query must not kill the rest
                log.warning("linkedin: '%s' start=%s failed (%s)", query, start, e)
                break
            time.sleep(_DELAY)
    log.info("linkedin: %d unique India design postings", len(jobs))
    return jobs
