"""Dribbble Jobs source via its server-rendered job board.

Dribbble is design-native, so it's a strong fit, but its board is mostly remote/US.
We hit the board with ?location=India (server-side filters to India listings) and keep
only roles an Indian applicant could take (geo.accepts_india). Server-rendered HTML, no
auth. Returns RAW job dicts; the classifier assigns 'discipline' later. Never raises.

Public contract:
    fetch() -> list[dict]
"""

import logging
import re

import httpx
from bs4 import BeautifulSoup

import geo

log = logging.getLogger("dod")

_BASE = "https://dribbble.com/jobs"
_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
# Two server-side India searches; both currently surface the same small set, so we dedup.
_QUERIES = [{"location": "India"}, {"keyword": "designer", "location": "India"}]
_PAGES = 2  # India yields few results; page 2 is usually empty, but check it cheaply.

_JOB_ID = re.compile(r"/jobs/(\d+)")


def _to_job(card) -> dict | None:
    link = card.select_one("a.job-link")
    href = link.get("href") if link else None
    m = _JOB_ID.search(href or "")
    if not m:
        return None
    job_id = m.group(1)

    title_el = card.select_one("h4.job-board-job-title") or card.select_one(".job-board-job-title")
    if title_el is None:
        return None
    title = title_el.get_text(strip=True)

    comp_el = card.select_one(".job-board-job-company")
    company = comp_el.get_text(strip=True) if comp_el else None

    # The mobile block carries the listing's stated location (e.g. "Bangalore, India");
    # an adjacent ".color-deep-blue-sea-light-40" holds a "Remote" flag when applicable.
    loc_el = (card.select_one(".job-details--mobile .location-container")
              or card.select_one(".location-container")
              or card.select_one("span.location"))
    location = loc_el.get_text(strip=True) if loc_el else None
    remote_el = card.select_one(".job-details--mobile .color-deep-blue-sea-light-40")
    if remote_el and "remote" in remote_el.get_text(strip=True).lower():
        location = f"{location} (Remote)" if location else "Remote"

    # India filter: keep India-located roles, plus generic remote not pinned elsewhere.
    if not geo.accepts_india(location):
        return None

    # Team/company logo <img> in the card's .company-avatar block. It lazy-loads, so the
    # real URL is usually in data-src; fall back to src. cdn.dribbble.com URLs are absolute.
    logo_el = card.select_one(".company-avatar img")
    logo = None
    if logo_el is not None:
        cand = logo_el.get("data-src") or logo_el.get("src")
        if isinstance(cand, str) and cand.startswith("http"):
            logo = cand

    return {
        "id": f"dribbble:{job_id}",
        "source": "dribbble",
        "title": title,
        "company": company,
        "location": location,
        "url": f"https://dribbble.com{href.split('?')[0]}",
        "logo": logo,
        "contact": None,
        # The board only shows relative dates ("Posted 18 days ago"), not an ISO date.
        "posted_at": None,
        # Dribbble's India job cards carry no pay field, so salary is always None.
        "salary": None,
        "description": f"{title} {company or ''}".strip(),
    }


def fetch() -> list[dict]:
    """Pull India design roles from the Dribbble job board. Never raises."""
    jobs: list[dict] = []
    seen: set[str] = set()
    for params in _QUERIES:
        for page in range(1, _PAGES + 1):
            try:
                resp = httpx.get(
                    _BASE,
                    params={**params, "page": page},
                    headers=_UA, timeout=20, follow_redirects=True,
                )
                if resp.status_code != 200:
                    log.warning("dribbble: %s p%s -> HTTP %s", params, page, resp.status_code)
                    break
                cards = BeautifulSoup(resp.text, "html.parser").select("li.job-list-item")
                if not cards:
                    break
                for card in cards:
                    job = _to_job(card)
                    if job and job["id"] not in seen:
                        seen.add(job["id"])
                        jobs.append(job)
            except Exception as e:  # noqa: BLE001 - one bad request must not kill the rest
                log.warning("dribbble: %s p%s failed (%s)", params, page, e)
                break
    log.info("dribbble: %d unique India design postings", len(jobs))
    return jobs


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = fetch()
    print(f"count: {len(results)}")
    for j in results[:5]:
        line = f"dribbble | {j['location']} | {j['title']}"
        print(line.encode("ascii", "replace").decode("ascii"))
