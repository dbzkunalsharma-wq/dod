"""Apna (apna.co) India design-jobs source via its Next.js SSR data blob.

Apna is a large India-only jobs platform. Its job-search pages are server-rendered
by Next.js: every listing page embeds the full result set in a
`<script id="__NEXT_DATA__">` JSON blob under props.pageProps.jobs -- no auth, no
separate XHR token needed. There is no documented public REST/GraphQL endpoint, but
the SSR blob IS the data the page renders from, so we read it directly.

Apna buckets roles into "categories"; the design-relevant ones are reachable with a
stable `?category_id=<id>` query (with `&page=N` paging). We hit the design categories
-- Graphic/UI-UX/Web Designer, Fashion Designer, Photography/Video -- and let the
downstream classifier make the final discipline call. We deliberately skip the broad
"UX, Design & Architecture" department slug because it mixes in unrelated roles
(telecalling, delivery, etc.). Apna is India-only, so location is always in India.

Returns RAW job dicts; the classifier assigns 'discipline' later. Never raises: a
failed page is logged and skipped.

Public contract:
    fetch() -> list[dict]
"""

import json
import logging
import re
import time

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger("dod")

_BASE = "https://apna.co/jobs"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://apna.co/jobs",
}

# Apna job-category ids (from the page's own categoryList) that map to design roles.
# 16 (Graphic Designer) is the core bucket and already surfaces UI/UX + Web + graphic
# designers; 1015 (Fashion Designer) and 1013 (Photography/Video Editing) add genuine
# visual/motion-design roles. The classifier still filters per result.
_CATEGORIES = {
    16: "graphic_designer",
    1015: "fashion_designer",
    1013: "photography_video_editing",
}
_PAGES = 4  # up to ~100 results per category, newest first; the totalPages guard stops early

# Pulls the embedded Next.js data blob out of the SSR HTML.
_NEXT_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S
)


def _strip(html_text) -> str:
    if not html_text:
        return ""
    return BeautifulSoup(str(html_text), "html.parser").get_text(" ", strip=True)


def _next_data(html: str) -> dict | None:
    m = _NEXT_RE.search(html)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except (ValueError, TypeError):
        return None


def _location(addr: dict) -> str:
    """Build 'Area, City, State' from Apna's nested address; fall back to 'India'."""
    if not isinstance(addr, dict):
        return "India"
    city = addr.get("city") or {}
    city_name = city.get("name") if isinstance(city, dict) else None
    state = None
    if isinstance(city, dict):
        state = (city.get("json_data") or {}).get("state")
    parts = [addr.get("area"), city_name, state]
    # De-dup while preserving order (area often == city on field jobs) and tidy spaces.
    seen, out = set(), []
    for p in parts:
        if not p:
            continue
        p = str(p).strip()
        key = p.lower()
        if p and key not in seen:
            seen.add(key)
            out.append(p)
    joined = ", ".join(out)
    return f"{joined}, India" if joined else "India"


def _salary(item: dict) -> str | None:
    """Apna gives min/max salary in INR per month; format what's present."""
    lo = item.get("min_salary") or item.get("fixed_min_salary")
    hi = item.get("max_salary") or item.get("fixed_max_salary")
    try:
        lo = int(lo) if lo else 0
        hi = int(hi) if hi else 0
    except (ValueError, TypeError):
        return None
    if lo and hi and hi != lo:
        return f"₹{lo:,} - ₹{hi:,} / year"
    val = hi or lo
    return f"₹{val:,} / year" if val else None


def _posted_at(item: dict) -> str | None:
    # created_on / last_updated are ISO timestamps; take the date part of created_on.
    for key in ("created_on", "last_updated"):
        ts = item.get(key)
        if isinstance(ts, str) and len(ts) >= 10:
            return ts[:10]
    return None


def _to_job(item: dict) -> dict | None:
    if not isinstance(item, dict):
        return None
    ext_id = item.get("id")
    title = item.get("title")
    if not ext_id or not title:
        return None

    org = item.get("organization") or {}
    logo = org.get("logo_url")
    if not (isinstance(logo, str) and logo.startswith("http")):
        logo = None

    url = (item.get("public_url_v2") or item.get("public_url")
           or f"https://apna.co/job/{ext_id}")

    title = str(title).strip()
    desc = _strip(item.get("description"))
    department = (item.get("department") or {}).get("name") or ""
    category = item.get("category") or ""
    # Give the classifier the title + department/category context + JD body.
    description = " ".join(p for p in (title, category, department, desc) if p).strip()

    return {
        "id": f"apna:{ext_id}",
        "source": "apna",
        "title": title,
        "company": org.get("name") or None,
        "location": _location(item.get("address") or {}),
        "url": url,
        "logo": logo,
        "contact": None,
        "posted_at": _posted_at(item),
        "salary": _salary(item),
        "description": description,
    }


def fetch() -> list[dict]:
    """Read each design category's SSR job blob across a few pages. Never raises."""
    jobs: list[dict] = []
    seen: set[str] = set()
    for cat_id, label in _CATEGORIES.items():
        for page in range(1, _PAGES + 1):
            try:
                resp = httpx.get(
                    _BASE,
                    params={"category_id": cat_id, "page": page},
                    headers=_HEADERS,
                    timeout=20,
                    follow_redirects=True,
                )
                if resp.status_code != 200:
                    log.warning("apna: %s p%s -> HTTP %s", label, page, resp.status_code)
                    break
                data = _next_data(resp.text)
                if not data:
                    log.warning("apna: %s p%s -> no __NEXT_DATA__", label, page)
                    break
                pp = (data.get("props") or {}).get("pageProps") or {}
                items = pp.get("jobs") or []
                if not items:
                    break
                added = 0
                for entry in items:
                    # Each entry is {"type": int, "data": {...job...}}; some are ads.
                    item = entry.get("data") if isinstance(entry, dict) else None
                    job = _to_job(item)
                    if job and job["id"] not in seen:
                        seen.add(job["id"])
                        jobs.append(job)
                        added += 1
                # Stop early if this category has fewer pages than _PAGES.
                total_pages = pp.get("totalPages")
                if isinstance(total_pages, int) and page >= total_pages:
                    break
                if added == 0:
                    break
            except Exception as e:  # noqa: BLE001 - one bad page must not kill the rest
                log.warning("apna: %s p%s failed (%s)", label, page, e)
                break
            time.sleep(1.0)  # polite pacing between SSR page loads
    log.info("apna: %d unique India design postings", len(jobs))
    return jobs


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = fetch()
    print(f"\nfetched {len(results)} jobs")
    for j in results[:5]:
        line = f"{j['source']} | {j.get('location') or '-'} | {j['title']}"
        print(line.encode("ascii", "replace").decode("ascii"))
