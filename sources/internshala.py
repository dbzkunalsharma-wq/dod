"""Internshala India design internships/jobs source via its server-rendered listing pages.

Internshala is an India-only platform (every listing is in India), so it's a strong fit
for design freshers/interns. The category/keyword listing pages are fully server-rendered:
each posting is an `.individual_internship` card carrying a stable `internshipid` attribute,
the title, company, location(s) and the full JD text. No auth, no AJAX needed -- pagination
is plain `.../page-N/`. Returns RAW job dicts; the classifier assigns 'discipline' later.
Never raises: a failed page is logged and skipped.

Public contract:
    fetch() -> list[dict]
"""

import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger("dod")

_HOST = "https://internshala.com"
_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}

# (path-segment, kind) per design category page. Multiple keyword pages maximise coverage;
# the classifier still makes the final call per result. `kind` only shapes the URL shape
# ("internships" vs "jobs") -- both render identical `.individual_internship` cards.
_CATEGORIES = [
    ("design-internship", "internships"),
    ("graphic-design-internship", "internships"),
    ("ui-ux-design-internship", "internships"),
    ("ui-ux-design-jobs", "jobs"),
    ("graphic-design-jobs", "jobs"),
    ("visual-design-jobs", "jobs"),
    ("motion-graphics-jobs", "jobs"),
    ("design-jobs", "jobs"),
    ("art-jobs", "jobs"),
    ("product-management-jobs", "jobs"),
    ("user-experience-ux-designer-jobs", "jobs"),
]
_PAGES = 3  # each category serves up to ~3 non-overlapping pages; the empty-page break stops early


def _strip(html_text) -> str:
    if not html_text:
        return ""
    return BeautifulSoup(str(html_text), "html.parser").get_text(" ", strip=True)


def _location(card) -> str:
    """First listed city + ", India". Internshala crams multiple cities into one anchor,
    so we keep only the primary city; 'Work from home' maps to a remote label."""
    loc_el = card.select_one(".locations a")
    raw = loc_el.get_text(strip=True) if loc_el else ""
    if not raw:
        return "India"  # Internshala is India-only, so a blank still belongs in-country
    if "work from home" in raw.lower():
        return "Remote (India)"
    city = raw.split(",")[0].strip()  # multi-location anchors are comma-joined; take the first
    return f"{city}, India" if city else "India"


def _stipend(card) -> str | None:
    """Clean stipend/salary string from the card's `.stipend` element, or None.

    Internship cards render it as "₹ 15,000 - 17,100 /month" (a leading ₹, a stray
    space, an en-dashable range and a "/month" suffix); job cards usually omit it.
    We tidy the spacing -> "₹15,000–17,100/month". Cards with a non-numeric placeholder
    (e.g. "Unpaid", "Competitive") are kept verbatim; truly empty -> None.
    """
    el = card.select_one(".stipend")
    if el is None:
        return None
    raw = el.get_text(" ", strip=True)
    if not raw:
        return None
    s = re.sub(r"\s+", " ", raw).strip()
    s = s.replace("₹ ", "₹")              # drop the stray space after the rupee sign
    s = re.sub(r"\s*-\s*", "–", s)        # "15,000 - 17,100" -> "15,000–17,100"
    s = re.sub(r"\s*/\s*month", "/month", s)
    return s or None


def _posted_at(card) -> str | None:
    """Convert Internshala's relative 'Posted X ago' label to an ISO date.

    Cards never show an absolute date, only e.g. 'Posted 3 weeks ago'. We anchor on
    'posted ... ago' (falling back to the first relative-time mention) and subtract
    from now, so the feed shows the REAL posting age instead of falling back to the
    scrape time (which made 3-week-old posts read as '6h ago').
    """
    low = card.get_text(" ", strip=True).lower()
    now = datetime.now(timezone.utc)
    num = r"(\d+|a|an|few|couple|several)"
    unit = r"(minute|min|hour|hr|day|week|month|year)"
    m = re.search(rf"posted\s+{num}\s*{unit}s?\s*ago", low)
    if not m:
        if re.search(r"posted\s+(?:just now|today)", low):
            return now.date().isoformat()
        if re.search(r"posted\s+yesterday", low):
            return (now - timedelta(days=1)).date().isoformat()
        m = re.search(rf"{num}\s*{unit}s?\s*ago", low)
    if not m:
        return None
    word = m.group(1)
    n = 1 if word in ("a", "an") else (3 if word in ("few", "couple") else 5 if word == "several" else int(word))
    per_day = {"minute": 0, "min": 0, "hour": 0, "hr": 0, "day": 1, "week": 7, "month": 30, "year": 365}
    return (now - timedelta(days=n * per_day[m.group(2)])).date().isoformat()


def _to_job(card) -> dict | None:
    ext_id = card.get("internshipid")
    title_el = card.select_one(".job-internship-name")
    if not ext_id or title_el is None:
        return None
    title = title_el.get_text(strip=True)
    if not title:
        return None

    comp_el = card.select_one(".company-name")
    href = card.get("data-href") or ""
    link_el = card.select_one("a[href]")
    if not href and link_el:
        href = link_el.get("href") or ""
    url = (_HOST + href) if href.startswith("/") else (href or None)

    # Company logo <img> inside the card's .internship_logo block (src already absolute on
    # the internshala-uploads CDN; prefix the host defensively for any relative path).
    logo_el = card.select_one(".internship_logo img") or card.select_one(".company_logo img")
    logo = None
    if logo_el is not None:
        src = logo_el.get("src") or logo_el.get("data-src")
        if isinstance(src, str) and src:
            logo = src if src.startswith("http") else (_HOST + src if src.startswith("/") else None)

    # The card text bundles title, company, locations, stipend, duration and the JD --
    # rich enough for the classifier (mirrors unstop's title + details concatenation).
    return {
        "id": f"internshala:{ext_id}",
        "source": "internshala",
        "title": title,
        "company": comp_el.get_text(strip=True) if comp_el else None,
        "location": _location(card),
        "url": url,
        "logo": logo,
        "contact": None,
        "posted_at": _posted_at(card),
        "salary": _stipend(card),
        "description": _strip(card),
    }


def fetch() -> list[dict]:
    """Scrape each design category page (a couple of pages each). Never raises."""
    jobs: list[dict] = []
    seen: set[str] = set()
    for slug, kind in _CATEGORIES:
        for page in range(1, _PAGES + 1):
            url = f"{_HOST}/{kind}/{slug}/" + (f"page-{page}/" if page > 1 else "")
            try:
                resp = httpx.get(url, headers=_UA, timeout=20, follow_redirects=True)
                if resp.status_code != 200:
                    log.warning("internshala: %s p%s -> HTTP %s", slug, page, resp.status_code)
                    break
                cards = BeautifulSoup(resp.text, "html.parser").select(".individual_internship")
                if not cards:
                    break
                for card in cards:
                    job = _to_job(card)
                    if job and job["id"] not in seen:
                        seen.add(job["id"])
                        jobs.append(job)
            except Exception as e:  # noqa: BLE001 - one bad page must not kill the rest
                log.warning("internshala: %s p%s failed (%s)", slug, page, e)
                break
    log.info("internshala: %d unique India design postings", len(jobs))
    return jobs


if __name__ == "__main__":
    results = fetch()
    print(f"internshala: {len(results)} postings")
    for j in results[:5]:
        line = f"internshala | {j['location']} | {j['title']}"
        print(line.encode("ascii", "replace").decode())
