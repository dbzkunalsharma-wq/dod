"""Shine (shine.com) India design-jobs source via the embedded Next.js data blob.

Shine is a Next.js site that ships its full search-result set in a
``<script id="__NEXT_DATA__" type="application/json">`` blob on each job-search
page -- no separate API call, no login, no captcha. We parse that JSON
(props.pageProps.initialState.jsrp.searchresult.data.results), which is far more
robust than scraping the rendered DOM. Returns RAW job dicts; the classifier
assigns 'discipline' later. Never raises: a failed request is logged and skipped.

Public contract:
    fetch() -> list[dict]
"""

import logging
import re

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger("dod")

_BASE = "https://www.shine.com/job-search"
_UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

# Each keyword is a Shine search-slug. Keyword genuinely changes the result set
# (verified: ~6/20 overlap between slugs), so all four add coverage. The
# classifier still makes the final discipline call per result.
# Each slug genuinely changes the result set; verified that these extra slugs all return
# a populated __NEXT_DATA__ blob (~20 results each). The classifier makes the final call.
_KEYWORDS = [
    "ui-ux-designer",
    "graphic-designer",
    "product-designer",
    "visual-designer",
    "motion-graphics-designer",
    "ux-researcher",
    "interaction-designer",
    "web-designer",
    "illustrator",
    "art-director",
    "brand-designer",
    "design-intern",
]
_PAGES = 3  # pages per keyword (~20 results each; out-of-range pages re-serve seen ids -> break)


def _strip(html_text) -> str:
    if not html_text:
        return ""
    return BeautifulSoup(str(html_text), "html.parser").get_text(" ", strip=True)


def _page_url(keyword: str, page: int) -> str:
    # Shine paginates via a path suffix (".../<kw>-jobs-in-india-2"), NOT a query
    # param -- ?page=N is silently ignored and re-serves page 1.
    base = f"{_BASE}/{keyword}-jobs-in-india"
    return base if page == 1 else f"{base}-{page}"


def _location(item) -> str | None:
    locs = item.get("jLoc")
    if isinstance(locs, list) and locs:
        joined = ", ".join(str(p) for p in locs if p)
        if joined:
            return joined
    return None


# Placeholder jSal values that mean "no figure" rather than a real number.
_HIDDEN_SAL = re.compile(r"hidden|not\s*disclosed|negotiable|as\s*per", re.IGNORECASE)


def _salary(item) -> str | None:
    """Clean pay from the job object's jSal field, or None when hidden/absent.

    jSal is a ready display string -- either a placeholder like "[Salary Hidden]" (->
    None) or a real range such as "Rs 2.0 - 3.0 Lakh/Yr". We normalise "Rs" to ₹ and
    tidy the spacing, otherwise passing the site's own wording through unchanged.
    """
    raw = item.get("jSal")
    if not isinstance(raw, str):
        return None
    s = re.sub(r"\s+", " ", raw).strip().strip("[]").strip()
    if not s or _HIDDEN_SAL.search(s):
        return None
    s = re.sub(r"^Rs\.?\s*", "₹", s)      # "Rs 2.0 - 3.0 Lakh/Yr" -> "₹2.0 - 3.0 Lakh/Yr"
    s = re.sub(r"\s*-\s*", "–", s)        # tidy the range dash
    return s or None


def _to_job(item) -> dict | None:
    title = item.get("jJT")
    ext_id = item.get("id")
    slug = item.get("jSlug")
    if not title or not ext_id or not slug:
        return None
    desc = _strip(item.get("jJD"))
    kwd = item.get("jKwd") or ""
    return {
        "id": f"shine:{ext_id}",
        "source": "shine",
        "title": title,
        "company": item.get("jCName") or None,
        "location": _location(item),
        # jSlug is "title/company/<id>"; the canonical job URL needs the /jobs/ prefix.
        "url": f"https://www.shine.com/jobs/{slug}",
        # The __NEXT_DATA__ job object carries no company-logo field, so logo is always None.
        "logo": None,
        "contact": item.get("jRE") or None,  # recruiter email, when Shine exposes it
        "posted_at": (item.get("jPDate") or "")[:10] or None,
        "salary": _salary(item),
        "description": (f"{title} {desc} {kwd}").strip(),
    }


def _results(payload) -> list:
    """Pull the job list out of the __NEXT_DATA__ JSON; [] if the shape is unexpected."""
    try:
        return payload["props"]["pageProps"]["initialState"]["jsrp"]["searchresult"]["data"]["results"] or []
    except (KeyError, TypeError):
        return []


def fetch() -> list[dict]:
    """Query each design keyword for India roles via the embedded blob. Never raises."""
    import json

    jobs: list[dict] = []
    seen: set[str] = set()
    for keyword in _KEYWORDS:
        for page in range(1, _PAGES + 1):
            try:
                resp = httpx.get(
                    _page_url(keyword, page),
                    headers=_UA, timeout=20, follow_redirects=True,
                )
                if resp.status_code != 200:
                    log.warning("shine: '%s' p%s -> HTTP %s", keyword, page, resp.status_code)
                    break
                tag = BeautifulSoup(resp.text, "html.parser").find("script", id="__NEXT_DATA__")
                if tag is None or not tag.string:
                    log.warning("shine: '%s' p%s -> no __NEXT_DATA__ blob", keyword, page)
                    break
                items = _results(json.loads(tag.string))
                if not items:
                    break
                added = 0
                for it in items:
                    job = _to_job(it)
                    if job and job["id"] not in seen:
                        seen.add(job["id"])
                        jobs.append(job)
                        added += 1
                # Out-of-range pages clamp to the last valid page and re-serve seen
                # ids; if a page adds nothing new, further pages won't either.
                if added == 0:
                    break
            except Exception as e:  # noqa: BLE001 - one bad request must not kill the rest
                log.warning("shine: '%s' p%s failed (%s)", keyword, page, e)
                break
    log.info("shine: %d unique India design postings", len(jobs))
    return jobs


if __name__ == "__main__":
    results = fetch()
    print(f"count: {len(results)}")
    for j in results[:5]:
        line = f"{j['source']} | {j['location']} | {j['title']}"
        print(line.encode("ascii", "replace").decode("ascii"))
