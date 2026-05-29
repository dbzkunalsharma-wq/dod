"""Foundit (foundit.in, ex-Monster India) design-jobs source via its public JSON API.

The SRP at https://www.foundit.in/srp/results is React-rendered, but its frontend
fetches results from a public middleware endpoint that returns JSON. No auth, but the
endpoint does content negotiation and 400s unless a foundit.in Referer is sent. We hit
it directly per design keyword for India roles. Returns RAW job dicts; the classifier
assigns 'discipline' later. Never raises: a failed query is logged and skipped.

Public contract:
    fetch() -> list[dict]
"""

import logging
import time

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger("dod")

_BASE = "https://www.foundit.in/middleware/jobsearch"
# The middleware 400s ("content negotiation failed") without a foundit.in Referer, so
# it is REQUIRED here, not optional politeness.
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.foundit.in/srp/results?query=designer&locations=India",
}

# Design-discipline queries; the classifier still makes the final call per result.
_QUERIES = [
    "UI UX designer", "graphic designer", "product designer",
    "visual designer", "motion designer", "industrial designer",
    "interaction designer", "communication designer",
]
_LOCATION = "India"
_LIMIT = 25
_STARTS = (0, 25)        # two pages (~50 results) per query
_DELAY = 1.0             # seconds between requests, to stay polite / avoid throttling


def _strip(html_text) -> str:
    if not html_text:
        return ""
    return BeautifulSoup(str(html_text), "html.parser").get_text(" ", strip=True)


def _join(value) -> str:
    """Flatten Foundit's list-or-string fields (functions/industries/etc.) to text."""
    if isinstance(value, list):
        return ", ".join(str(v) for v in value if v)
    return str(value) if value else ""


def _posted_at(item) -> str | None:
    # createdAt / freshness are epoch millis; convert to an ISO date when present.
    ts = item.get("createdAt") or item.get("freshness")
    if isinstance(ts, (int, float)) and ts > 0:
        try:
            return time.strftime("%Y-%m-%d", time.gmtime(ts / 1000))
        except (ValueError, OverflowError, OSError):
            return None
    return None


def _lpa(rupees: float) -> str:
    """Render an annual INR figure as a compact LPA string (e.g. 500000 -> '5', 650000 -> '6.5')."""
    lpa = rupees / 100000
    # Trim a trailing '.0' so whole lakhs read cleanly ("5 LPA" not "5.0 LPA").
    return f"{lpa:.1f}".rstrip("0").rstrip(".")


def _salary(item) -> str | None:
    """Clean human-readable pay from the SRP item, or None when undisclosed.

    The item carries structured minimumSalary/maximumSalary dicts (annual INR in
    `absoluteValue`) plus a prebuilt `salary` display string. We trust the structured
    numbers: a 0/0 range (the common case) or a confidential flag means "not disclosed"
    -> None. When real numbers are present we format a tidy "₹X–Y LPA" range; otherwise
    we fall back to the prebuilt display string if it isn't the empty "0-0" sentinel.
    """
    if item.get("jobSalaryConfidential") is True:
        return None
    mn = item.get("minimumSalary") or {}
    mx = item.get("maximumSalary") or {}
    lo = mn.get("absoluteValue") if isinstance(mn, dict) else None
    hi = mx.get("absoluteValue") if isinstance(mx, dict) else None
    lo = lo if isinstance(lo, (int, float)) and lo > 0 else 0
    hi = hi if isinstance(hi, (int, float)) and hi > 0 else 0
    if lo or hi:
        if lo and hi and hi != lo:
            return f"₹{_lpa(lo)}–{_lpa(hi)} LPA"
        return f"₹{_lpa(hi or lo)} LPA"
    # No usable structured numbers: salvage the display string only if it's a real value.
    disp = item.get("salary")
    if isinstance(disp, str):
        disp = disp.strip()
        digits = disp.replace(",", "").replace("0", "").replace("-", "").replace(" ", "")
        # "0-0 INR" (and "0 INR") strip down to just the currency code -> treat as None.
        if disp and not disp.lower().startswith(("0-0", "0 ")) and digits.lower() != "inr":
            return disp
    return None


def _description(item, title: str) -> str:
    # The SRP payload carries no full JD text; build a meaningful blob for the
    # classifier from the structured fields that ARE present.
    parts = [
        title,
        _join(item.get("functions")),
        _join(item.get("industries")),
        _strip(item.get("skills")),
        item.get("exp") or "",
    ]
    return " ".join(p for p in parts if p).strip()


def _to_job(item) -> dict | None:
    # The data[] array mixes in ad/separator tuples (just {index, type}); skip anything
    # without a real id + title.
    if not isinstance(item, dict):
        return None
    ext_id = item.get("jobId") or item.get("id")
    title = item.get("title")
    if not ext_id or not title:
        return None

    # jdUrl/seoJdUrl are relative paths to the Foundit detail page; applyUrl/redirectUrl
    # may point off-site (LinkedIn etc.). Prefer the stable Foundit detail page.
    jd = item.get("seoJdUrl") or item.get("jdUrl")
    url = (f"https://www.foundit.in{jd}" if jd and jd.startswith("/")
           else jd or item.get("applyUrl") or item.get("redirectUrl"))

    location = item.get("locations") or None  # e.g. "Bengaluru, India"

    # The SRP item carries the company logo as companyLogo / companyLogoUrl (an absolute
    # media.monsterindia.com URL when present; empty for some employers -> None). Prefix
    # the host defensively in case a relative path ever shows up.
    raw_logo = item.get("companyLogo") or item.get("companyLogoUrl")
    if isinstance(raw_logo, str) and raw_logo:
        logo = raw_logo if raw_logo.startswith("http") else (
            f"https://www.foundit.in{raw_logo}" if raw_logo.startswith("/") else None
        )
    else:
        logo = None

    return {
        "id": f"foundit:{ext_id}",
        "source": "foundit",
        "title": str(title).strip(),
        "company": item.get("companyName") or None,
        "location": location,
        "url": url,
        "logo": logo,
        "contact": None,
        "posted_at": _posted_at(item),
        "salary": _salary(item),
        "description": _description(item, str(title).strip()),
    }


def fetch() -> list[dict]:
    """Query each design discipline for India roles via the middleware API. Never raises."""
    jobs: list[dict] = []
    seen: set[str] = set()
    for query in _QUERIES:
        for start in _STARTS:
            try:
                resp = httpx.get(
                    _BASE,
                    params={"query": query, "locations": _LOCATION,
                            "start": start, "limit": _LIMIT, "sort": 1},
                    headers=_HEADERS,
                    timeout=20,
                )
                if resp.status_code != 200:
                    log.warning("foundit: '%s' start=%s -> HTTP %s", query, start, resp.status_code)
                    break
                payload = resp.json().get("jobSearchResponse") or {}
                items = payload.get("data") if isinstance(payload, dict) else []
                if not items:
                    break
                for it in items:
                    job = _to_job(it)
                    if job and job["id"] not in seen:
                        seen.add(job["id"])
                        jobs.append(job)
            except Exception as e:  # noqa: BLE001 - one bad query must not kill the rest
                log.warning("foundit: '%s' start=%s failed (%s)", query, start, e)
                break
            time.sleep(_DELAY)
    log.info("foundit: %d unique India design postings", len(jobs))
    return jobs


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    results = fetch()
    print(f"\nfetched {len(results)} jobs")
    for j in results[:5]:
        line = f"{j['source']} | {j.get('location') or '-'} | {j['title']}"
        print(line.encode("ascii", "replace").decode("ascii"))
