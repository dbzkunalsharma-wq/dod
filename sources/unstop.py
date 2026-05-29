"""Unstop India jobs/internships source via its public search API.

Unstop (ex-Dare2Compete) is India-student-focused, so it's a strong fit for design
freshers/interns. Public JSON endpoint, no auth. Returns RAW job dicts; the classifier
assigns 'discipline' later. Never raises.

Public contract:
    fetch() -> list[dict]
"""

import logging

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger("dod")

_BASE = "https://unstop.com/api/public/opportunity/search-result"
_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
_QUERIES = ["designer", "ux", "graphic design", "product design"]
_PAGES = 2


def _strip(html_text) -> str:
    if not html_text:
        return ""
    return BeautifulSoup(str(html_text), "html.parser").get_text(" ", strip=True)


def _salary(item) -> str | None:
    """Pay from the nested jobDetail block, or None when hidden/undisclosed/absent.

    jobDetail carries min_salary/max_salary (INR), show_salary (0/1), not_disclosed and
    pay_in ("annually"/"monthly"). `prizes` is a competition-only field (cash is null for
    jobs) so it is deliberately ignored. We only emit a string for a real, shown figure.
    Annual pay renders as a compact LPA range ("₹6–7 LPA"); monthly pay keeps grouped
    rupees with a "/month" suffix ("₹15,000–20,000/month").
    """
    jd = item.get("jobDetail")
    if not isinstance(jd, dict):
        return None
    if jd.get("show_salary") in (0, "0", False) or jd.get("not_disclosed") is True:
        return None
    lo = jd.get("min_salary")
    hi = jd.get("max_salary")
    lo = lo if isinstance(lo, (int, float)) and lo > 0 else 0
    hi = hi if isinstance(hi, (int, float)) and hi > 0 else 0
    if not (lo or hi):
        return None
    # Render as LPA only when the feed says annual AND the figure is lakh-scale. A few
    # rows are mislabeled "annually" while carrying a monthly amount (e.g. 20,000); those
    # are obviously monthly, so the magnitude check keeps us from emitting "₹0.2 LPA".
    annual = (jd.get("pay_in") or "").lower() == "annually" and max(lo, hi) >= 100000
    if annual:
        fmt = lambda n: f"{n / 100000:.1f}".rstrip("0").rstrip(".")  # noqa: E731 -> lakhs
        unit = " LPA"
    else:
        fmt = lambda n: f"{int(round(n)):,}"                        # noqa: E731 -> grouped rupees
        unit = "/month"
    if lo and hi and hi != lo:
        return f"₹{fmt(lo)}–{fmt(hi)}{unit}"
    return f"₹{fmt(hi or lo)}{unit}"


def _location(item) -> str:
    locs = item.get("locations")
    if isinstance(locs, list) and locs:
        parts = [l.get("name") if isinstance(l, dict) else str(l) for l in locs]
        joined = ", ".join(p for p in parts if p)
        if joined:
            return joined
    if item.get("region") == "online":
        return "Remote (India)"
    return "India"  # Unstop is an India-focused platform


def _to_job(item) -> dict | None:
    title = item.get("title")
    if not title or item.get("regn_open") != 1:  # only roles still open for registration
        return None
    org = item.get("organisation") or {}
    pub = item.get("public_url") or ""
    url = item.get("seo_url") or (f"https://unstop.com/{pub}" if pub else None)
    # First non-empty absolute logo URL: the item-level logoUrl2, else org.logoUrl.
    logo = next(
        (u for u in (item.get("logoUrl2"), org.get("logoUrl"))
         if isinstance(u, str) and u.startswith("http")),
        None,
    )
    return {
        "id": f"unstop:{item.get('id')}",
        "source": "unstop",
        "title": title,
        "company": org.get("name"),
        "location": _location(item),
        "url": url,
        "logo": logo,
        "contact": None,
        "posted_at": (item.get("updated_at") or "")[:10] or None,
        "salary": _salary(item),
        "description": f"{title} {_strip(item.get('details'))}",
    }


def fetch() -> list[dict]:
    jobs: list[dict] = []
    seen: set[str] = set()
    for query in _QUERIES:
        for page in range(1, _PAGES + 1):
            try:
                resp = httpx.get(
                    _BASE,
                    params={"opportunity": "jobs", "page": page, "per_page": 30, "searchTerm": query},
                    headers=_UA, timeout=20,
                )
                if resp.status_code != 200:
                    log.warning("unstop: '%s' p%s -> HTTP %s", query, page, resp.status_code)
                    break
                data = resp.json().get("data") or {}
                items = data.get("data") if isinstance(data, dict) else []
                if not items:
                    break
                for it in items:
                    job = _to_job(it)
                    if job and job["id"] not in seen:
                        seen.add(job["id"])
                        jobs.append(job)
            except Exception as e:  # noqa: BLE001 - one bad query must not kill the rest
                log.warning("unstop: '%s' p%s failed (%s)", query, page, e)
                break
    log.info("unstop: %d unique postings", len(jobs))
    return jobs


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = fetch()
    print(f"unstop: {len(results)} postings")
    for j in results[:5]:
        line = f"unstop | {j['location']} | {j.get('salary') or '-'} | {j['title']}"
        print(line.encode("ascii", "replace").decode("ascii"))
