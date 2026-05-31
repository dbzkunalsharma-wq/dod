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
# The FULL set is run against the India-wide location; a CORE subset (the highest-volume
# design titles) is additionally run per-city, because LinkedIn caps the result set per
# (keyword, location) query — so slicing by city surfaces far more unique roles than a
# single "India" pass ever can.
_QUERIES = [
    "UI UX Designer", "Product Designer", "Graphic Designer", "Visual Designer",
    "Motion Designer", "Interaction Designer", "UX Researcher",
    "Industrial Designer", "Communication Designer", "Brand Designer",
    "Design Lead", "Design Manager", "Service Designer", "UX Writer",
    "Packaging Designer", "Web Designer",
]
_CORE_QUERIES = [
    "UI UX Designer", "Product Designer", "Graphic Designer", "Visual Designer",
    "Motion Designer", "UX Researcher", "Brand Designer",
]

# The India-wide pass (kept) plus the major design-hiring metros. LinkedIn resolves a
# plain city name in `location`, so the human label doubles as the query value;
# "Remote, India" catches the remote-open-to-India roles.
_LOCATION = "India"
_CITIES = [
    "Bengaluru, India", "Mumbai, India", "Delhi, India", "Gurgaon, India",
    "Noida, India", "Hyderabad, India", "Pune, India", "Chennai, India",
    "Kolkata, India", "Ahmedabad, India", "Remote, India",
]

# Pagination, per pass. LinkedIn's guest endpoint serves ~25 cards per call and `start`
# is a row offset; two pages for the broad India pass, one page per (city, keyword) to
# keep the total request count bounded.
_WIDE_STARTS = (0, 25)   # India-wide: 16 keywords x 2 pages = 32 requests
_CITY_STARTS = (0,)      # per-city:   11 cities x 7 core keywords x 1 page = 77 requests
_DELAY = 1.2             # seconds between requests, to stay polite / avoid throttling
# -> ~109 guest requests total (bounded; well under the ~120-160 ceiling).


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


def _run_query(query: str, location: str, starts, jobs: list[dict], seen: set[str]) -> None:
    """Run one (keyword, location) sweep across `starts`, appending unseen jobs in place.

    Mirrors the original per-query loop: a non-200 (e.g. a 429 mid-run) or an empty page
    breaks THIS query only, so the other queries still land. Never raises."""
    for start in starts:
        try:
            resp = httpx.get(
                _BASE,
                params={"keywords": query, "location": location, "start": start},
                headers=_UA,
                timeout=20,
            )
            if resp.status_code != 200:
                log.warning("linkedin: '%s' @ '%s' start=%s -> HTTP %s",
                            query, location, start, resp.status_code)
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
            log.warning("linkedin: '%s' @ '%s' start=%s failed (%s)", query, location, start, e)
            break
        time.sleep(_DELAY)


def fetch() -> list[dict]:
    """Query each design discipline for India roles via the guest endpoint, across both
    the India-wide location and the major metros (per-city surfaces far more unique roles
    than the capped India-wide query alone). Dedup by job id. Never raises."""
    jobs: list[dict] = []
    seen: set[str] = set()

    # (1) Broad India-wide pass: every keyword, two pages.
    for query in _QUERIES:
        _run_query(query, _LOCATION, _WIDE_STARTS, jobs, seen)

    # (2) Per-city deepening: the core (highest-volume) keywords against each metro.
    for city in _CITIES:
        for query in _CORE_QUERIES:
            _run_query(query, city, _CITY_STARTS, jobs, seen)

    log.info("linkedin: %d unique India design postings (India-wide + %d cities)",
             len(jobs), len(_CITIES))
    return jobs


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = fetch()
    print(f"\nfetched {len(results)} jobs")
    for j in results[:5]:
        line = f"{j['source']} | {j.get('location') or '-'} | {j['title']}"
        print(line.encode("ascii", "replace").decode("ascii"))
