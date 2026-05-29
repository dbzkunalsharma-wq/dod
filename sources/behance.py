"""Behance JobList (Adobe) India design-jobs source via embedded page JSON.

Behance is design-native, so its job board is a strong fit for DOD. There is no
anonymous JSON API for the board (the XHR variant of /joblist returns an empty
legacy `jobSearch` payload), but every page server-side-renders the full board
state into a `<script id="beconfig-store_state" type="application/json">` blob,
under `combinedJobListings.combinedJobListings.nodes`. We read that directly and
paginate with `?page=N` (each page is a fresh set of ~20 jobs; zero overlap).

A listing node lacks a description, posted date, salary and a hiring contact, so
for each India job we fetch its detail page once and pull the richer
`jobDetails.job` object (HTML `description`, `postedOn` unix timestamp, `company`
logo, salary, hirer profile URL). Detail enrichment is best-effort: if it fails we
keep listing-level fields.

Behance personalizes the first pages by request IP, so for an India-based caller
the board is already India-heavy; deeper pages go global. We page through anyway
and keep only listings whose location names India or a major Indian city. Returns
RAW job dicts; the classifier assigns 'discipline' later. Never raises.

Public contract:
    fetch() -> list[dict]
"""

import datetime as dt
import json
import logging
import re
import time

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger("dod")

_BASE = "https://www.behance.net/joblist"
_UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}
_PAGES = 6            # board pages to scan; early pages are IP-localized to India, rest global
_DELAY = 1.0          # seconds between requests, to stay polite / avoid throttling

# Major Indian cities so we still match listings that name a city without "India"
# (e.g. "Gurgaon"). Word-boundaried to avoid false hits like "Indiana"/"Indianapolis".
_INDIA_CITIES = (
    "india", "bangalore", "bengaluru", "mumbai", "delhi", "new delhi", "gurgaon",
    "gurugram", "noida", "hyderabad", "chennai", "kolkata", "pune", "ahmedabad",
    "surat", "jaipur", "kochi", "cochin", "chandigarh", "indore", "coimbatore",
    "lucknow", "nagpur", "vadodara", "mysore", "mysuru", "goa", "mohali", "vizag",
    "visakhapatnam", "thiruvananthapuram", "trivandrum", "bhubaneswar", "nashik",
)
_INDIA_RE = re.compile(r"\b(" + "|".join(re.escape(c) for c in _INDIA_CITIES) + r")\b")

# Company logo lives under company.imageSizes; pick the largest available variant.
_LOGO_SIZES = ("size_max", "size_276", "size_230", "size_180", "size_138", "size_115", "size_100")


def _strip(html_text) -> str:
    if not html_text:
        return ""
    return BeautifulSoup(str(html_text), "html.parser").get_text(" ", strip=True)


def _is_india(location) -> bool:
    return bool(location) and bool(_INDIA_RE.search(location.lower()))


def _iso_date(ts) -> str | None:
    """Behance posts dates as unix seconds; return ISO date or None."""
    if not ts:
        return None
    try:
        return dt.datetime.fromtimestamp(int(ts), dt.timezone.utc).date().isoformat()
    except (ValueError, OverflowError, OSError):
        return None


def _node_location(node) -> str | None:
    loc = node.get("location")
    if loc:
        return loc
    locs = node.get("locations")
    if isinstance(locs, list) and locs and isinstance(locs[0], dict):
        return locs[0].get("displayName")
    if node.get("isRemote"):
        return "Remote"
    return None


def _logo_from_company(company) -> str | None:
    """Largest company-logo URL from a `company.imageSizes` map, or None."""
    sizes = company.get("imageSizes") if isinstance(company, dict) else None
    if not isinstance(sizes, dict):
        return None
    for key in _LOGO_SIZES:
        url = (sizes.get(key) or {}).get("url") if isinstance(sizes.get(key), dict) else None
        if isinstance(url, str) and url.startswith("http"):
            return url
    return None


def _salary(job) -> str | None:
    """Behance almost never fills amounts; emit a string only when one is present."""
    lo, hi = job.get("salaryMin"), job.get("salaryMax")
    if not (lo or hi):
        return None
    cur = job.get("salaryCurrency") or ""
    tf = (job.get("salaryTimeframe") or "").replace("_", " ").lower()
    amount = f"{lo}-{hi}" if (lo and hi) else str(lo or hi)
    return " ".join(p for p in (cur, amount, tf) if p).strip() or None


def _enrich(url: str) -> dict:
    """Fetch a job's detail page and pull description/posted_at/contact/logo/salary.

    Best-effort: returns {} on any failure so the caller keeps listing-level data.
    """
    try:
        resp = httpx.get(url, headers=_UA, timeout=20, follow_redirects=True)
        if resp.status_code != 200:
            log.warning("behance: detail %s -> HTTP %s", url, resp.status_code)
            return {}
        script = BeautifulSoup(resp.text, "html.parser").find(
            "script", id="beconfig-store_state"
        )
        if script is None or not script.string:
            return {}
        job = (json.loads(script.string).get("jobDetails") or {}).get("job")
        if not isinstance(job, dict):
            return {}
        creator = job.get("creator") or {}
        # Behance gates direct email behind its apply flow; the hirer's profile URL
        # is the closest stable, public contact we can record.
        contact = creator.get("url") or job.get("applicationUrl")
        fields = [c.get("name") for c in (job.get("creativeFields") or []) if isinstance(c, dict)]
        cats = [c.get("name") for c in (job.get("categories") or []) if isinstance(c, dict)]
        return {
            "description": _strip(job.get("description")),
            "posted_at": _iso_date(job.get("postedOn")),
            "contact": contact,
            "logo": _logo_from_company(job.get("company")),
            "salary": _salary(job),
            "location": job.get("locationDisplay"),
            "extra_terms": " ".join(t for t in fields + cats if t),
        }
    except Exception as e:  # noqa: BLE001 - a bad detail page must not lose the listing
        log.warning("behance: detail %s failed (%s)", url, e)
        return {}


def _to_job(node) -> dict | None:
    """Build a RAW job dict from a listing node, enriching from its detail page."""
    job_id = node.get("id")
    title = node.get("title")
    url = node.get("url")
    if not job_id or not title or not url:
        return None

    location = _node_location(node)
    if not _is_india(location):
        return None  # board is global; keep India only

    company = node.get("companyName") or (node.get("company") or {}).get("name")

    detail = _enrich(url)
    description = detail.get("description") or ""
    # Fold title/company/creative-fields into the classifier text so it has signal
    # even when the detail fetch yields a thin or empty description.
    terms = " ".join(p for p in (title, company, detail.get("extra_terms")) if p)
    description = f"{terms} {description}".strip()

    return {
        "id": f"behance:{job_id}",
        "source": "behance",
        "title": title,
        "company": company,
        # Prefer the detail page's locationDisplay (still India by the filter above).
        "location": detail.get("location") or location,
        "url": url,
        "contact": detail.get("contact"),
        "posted_at": detail.get("posted_at"),
        "logo": detail.get("logo") or _logo_from_company(node.get("company")),
        "salary": detail.get("salary"),
        "description": description,
    }


def fetch() -> list[dict]:
    """Scan Behance JobList pages, keep India design roles. Never raises."""
    jobs: list[dict] = []
    seen: set[str] = set()
    for page in range(1, _PAGES + 1):
        try:
            resp = httpx.get(
                _BASE, params={"page": page}, headers=_UA, timeout=20, follow_redirects=True
            )
            if resp.status_code != 200:
                log.warning("behance: page %s -> HTTP %s", page, resp.status_code)
                break
            script = BeautifulSoup(resp.text, "html.parser").find(
                "script", id="beconfig-store_state"
            )
            if script is None or not script.string:
                log.warning("behance: page %s -> no embedded job state", page)
                break
            inner = (
                json.loads(script.string)
                .get("combinedJobListings", {})
                .get("combinedJobListings", {})
            )
            nodes = inner.get("nodes") or []
            if not nodes:
                break
            for node in nodes:
                key = f"behance:{node.get('id')}"
                if key in seen:
                    continue
                seen.add(key)  # dedup before enriching to avoid duplicate detail fetches
                job = _to_job(node)
                if job:
                    jobs.append(job)
                    time.sleep(_DELAY)  # space out detail-page fetches we actually made
            if not inner.get("pageInfo", {}).get("hasNextPage", False):
                break
            time.sleep(_DELAY)
        except Exception as e:  # noqa: BLE001 - one bad page must not kill the rest
            log.warning("behance: page %s failed (%s)", page, e)
            break
    log.info("behance: %d unique India design postings", len(jobs))
    return jobs


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    results = fetch()
    print(f"count: {len(results)}")
    for j in results[:5]:
        line = f"behance | {j['location']} | {j['title']}"
        print(line.encode("ascii", "replace").decode("ascii"))
