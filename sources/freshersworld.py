"""Freshersworld (freshersworld.com) India design-jobs source via its server-rendered listing.

Freshersworld is an India-only fresher/entry-level board (every listing is in India), so it
is a strong fit for design freshers/interns. Its job-search pages are fully server-rendered:
each posting is a ``div.job-container`` card carrying the title, company, location, experience
and the detail-page link. No auth, no AJAX. Returns RAW job dicts; the classifier assigns
'discipline' later. Never raises: a failed request is logged and skipped.

Notes learned from probing the live site:
  * The keyword/category slug is effectively cosmetic -- every design slug 301-redirects to
    one canonical "design" listing, so a single fetch covers the board (extra slugs just
    re-serve identical cards). We therefore hit ONE listing and do not paginate (``?page=N``
    redirects back to the same ~20 cards).
  * Each card holds TWO anchors: a generic ``/jobs-in-<city>/<id>`` location ad (repeated
    across cards) and the REAL ``/jobs/<slug>-jobs-opening-in-...-<id>`` detail link. We key
    off the detail link (it ends in a stable numeric id) and ignore the city ad.
  * The visible title is boilerplate-padded ("<title> Jobs Opening in <company> at <city>"
    plus a trailing "LessMoreLess" toggle artifact); we strip both to a clean role title.

Public contract:
    fetch() -> list[dict]
"""

import logging
import re

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger("dod")

_HOST = "https://www.freshersworld.com"
_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}

# Design listing slugs. They all redirect to the same canonical design board, but we keep a
# couple as fallbacks in case one slug is retired; dedup on the numeric id collapses overlap.
_SLUGS = ["graphic-designer-jobs", "design-jobs"]


def _real_link(card):
    """The card's detail-page anchor (``/jobs/...-jobs-opening-in-...-<id>``), not the
    repeated ``/jobs-in-<city>/<id>`` location ad. Returns an absolute URL or None."""
    for a in card.select("a[href]"):
        href = a.get("href") or ""
        if "-jobs-opening-in-" in href or ("/jobs/" in href and re.search(r"-\d{5,}$", href)):
            return _HOST + href if href.startswith("/") else href
    return None


def _clean_title(raw: str) -> str:
    """Strip Freshersworld's boilerplate from the visible title.

    Cards render e.g. "Graphic Designer Jobs Opening in Acme at Pune LessMoreLess"; the
    "... Jobs Opening in <company> at <city>" tail and the "More/Less" toggle artifact are
    chrome, not the role. We keep only the leading role title.
    """
    t = re.sub(r"(?:Less|More)+$", "", raw or "").strip()
    t = re.split(r"\s+Jobs Opening in\s+", t, maxsplit=1)[0].strip()
    t = re.split(r"\s+Job\s+", t, maxsplit=1)[0].strip()  # "Graphic Designer Job Corel Draw..."
    return re.sub(r"\s+", " ", t).strip()


def _location(card) -> str:
    el = card.select_one(".job-location")
    raw = el.get_text(" ", strip=True) if el else ""
    raw = re.sub(r"\s+", " ", raw).strip().strip(",")
    if not raw:
        return "India"  # Freshersworld is India-only, so a blank still belongs in-country
    city = raw.split(",")[0].strip()
    return f"{city}, India" if city else "India"


def _salary(card) -> str | None:
    """The card's ``.qualifications`` chip carries pay like "20000 - 30000 Monthly" /
    "240000 - 300000 Yearly". Tidy it to "₹20,000–30,000/month" style; None when absent."""
    el = card.select_one(".qualifications")
    if el is None:
        return None
    raw = re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()
    m = re.search(r"(\d[\d,]*)\s*(?:-\s*(\d[\d,]*))?\s*(Monthly|Yearly)", raw, re.IGNORECASE)
    if not m:
        return None
    lo, hi, period = m.group(1), m.group(2), m.group(3).lower()
    fmt = lambda n: f"{int(n.replace(',', '')):,}"  # noqa: E731 -> grouped rupees
    unit = "/month" if period == "monthly" else "/year"
    body = f"{fmt(lo)}–{fmt(hi)}" if hi and hi != lo else fmt(hi or lo)
    return f"₹{body}{unit}"


def _to_job(card) -> dict | None:
    url = _real_link(card)
    if not url:
        return None
    m = re.search(r"-(\d{5,})$", url.split("?")[0].rstrip("/"))
    if not m:
        return None
    ext_id = m.group(1)
    tnode = card.select_one(".job-new-title")
    title = _clean_title(tnode.get_text(strip=True) if tnode else "")
    if not title:
        return None

    comp_el = card.select_one(".company-name")
    exp_el = card.select_one(".experience")
    img = card.select_one(".job-container img")
    logo = None
    if img is not None:
        src = img.get("data-src") or img.get("src")
        # Skip the generic Freshersworld placeholder sprite; keep real per-employer logos
        # (served off the static.freshersworld.com hot-jobs CDN).
        if isinstance(src, str) and src.startswith("http") and "hotjobs-logo" in src:
            logo = src

    # Bundle title + company + experience so the classifier has more than a bare title.
    exp = exp_el.get_text(" ", strip=True) if exp_el else ""
    company = comp_el.get_text(strip=True) if comp_el else None
    return {
        "id": f"freshersworld:{ext_id}",
        "source": "freshersworld",
        "title": title,
        "company": company,
        "location": _location(card),
        "url": url,
        "logo": logo,
        "contact": None,
        "posted_at": None,  # cards show only a bare "Posted:" label, no usable date
        "salary": _salary(card),
        "description": f"{title} {company or ''} {exp}".strip(),
    }


def _fetch_html(url: str) -> str | None:
    """GET the listing with a generous timeout + one retry. Freshersworld's search
    page is genuinely slow (observed 45-60s to first byte) and the first attempt often
    times out on a cold cache while the second succeeds, so 20s was giving up too early.
    Returns the HTML on a 200, else None. Never raises."""
    for attempt in (1, 2):
        try:
            resp = httpx.get(url, headers=_UA, timeout=70, follow_redirects=True)
            if resp.status_code == 200:
                return resp.text
            log.warning("freshersworld: %s -> HTTP %s", url, resp.status_code)
            return None
        except Exception as e:  # noqa: BLE001 - slow/flaky request must not kill the run
            log.warning("freshersworld: attempt %d/2 failed (%s)", attempt, e)
    return None


def fetch() -> list[dict]:
    """Scrape the Freshersworld design listing(s). Never raises."""
    jobs: list[dict] = []
    seen: set[str] = set()
    for slug in _SLUGS:
        url = f"{_HOST}/jobs/jobsearch/{slug}"
        html = _fetch_html(url)
        if not html:
            continue
        cards = BeautifulSoup(html, "html.parser").select("div.job-container")
        if not cards:
            continue
        added = 0
        for card in cards:
            job = _to_job(card)
            if job and job["id"] not in seen:
                seen.add(job["id"])
                jobs.append(job)
                added += 1
        # All design slugs redirect to the same canonical board; once a slug adds
        # nothing new, the remaining ones are duplicates -- stop early.
        if added == 0:
            break
    log.info("freshersworld: %d unique India design postings", len(jobs))
    return jobs


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = fetch()
    print(f"freshersworld: {len(results)} postings")
    for j in results[:5]:
        line = f"{j['source']} | {j['location']} | {j.get('salary') or '-'} | {j['title']}"
        print(line.encode("ascii", "replace").decode("ascii"))
