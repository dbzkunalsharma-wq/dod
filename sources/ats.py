"""ATS source: fetch raw job postings from company Applicant Tracking System feeds.

Companies publish here before aggregators copy them, so this is DOD's early-signal
backbone. Each ATS exposes a public JSON board endpoint; this module normalizes the
per-platform shapes into the common raw-job dict the classifier consumes.

Public contract (the poller imports this):
    fetch() -> list[dict]
Returns RAW job dicts WITHOUT a "discipline" key (the classifier assigns that later).
"""

import html
import json
import logging
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

import httpx

log = logging.getLogger(__name__)

WATCHLIST_PATH = Path(__file__).parent.parent / "watchlist.json"

TIMEOUT = 15.0
# A plain browser-like UA: some ATS edges reject the default httpx UA.
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DOD-jobtracker/1.0)"}


# --- HTML to plain text ---------------------------------------------------

class _TextExtractor(HTMLParser):
    """Collect text nodes, dropping tags. Block-level tags become newlines so the
    classifier sees word boundaries rather than runtogetherwords."""

    _BLOCK = {"p", "br", "div", "li", "ul", "ol", "tr", "h1", "h2", "h3",
              "h4", "h5", "h6", "section", "header", "footer"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []

    def handle_data(self, data):
        self._parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag in self._BLOCK:
            self._parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self._BLOCK:
            self._parts.append("\n")

    def text(self) -> str:
        return "".join(self._parts)


def strip_html(raw: str | None) -> str:
    """Return plain text from an HTML string. Stdlib only.

    Greenhouse serves its body as entity-encoded HTML (e.g. "&lt;p&gt;text&lt;/p&gt;"),
    so we unescape first to turn entities back into real tags, then strip them. On
    already-plain HTML this just decodes stray entities like &amp;, which is harmless.
    """
    if not raw:
        return ""
    parser = _TextExtractor()
    parser.feed(html.unescape(raw))
    text = parser.text()
    # Collapse the runs of whitespace/newlines the block handling introduces.
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


# --- small shared helpers -------------------------------------------------

def _ms_epoch_to_iso(ms) -> str | None:
    """Lever's createdAt is milliseconds since epoch (int). Return an ISO date."""
    if ms is None:
        return None
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).date().isoformat()
    except (ValueError, TypeError, OSError):
        return None


def _iso_date(value) -> str | None:
    """Normalize an ISO-ish timestamp to a YYYY-MM-DD date; pass through on doubt."""
    if not value:
        return None
    s = str(value)
    try:
        # fromisoformat handles offsets in 3.11+; normalize trailing Z just in case.
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return s[:10] if len(s) >= 10 else s


# --- per-platform normalizers ---------------------------------------------
# Each takes (entry, raw_response_json) and returns list[dict] in the common shape.
# Kept pure (no I/O) so they can be unit-tested offline with sample payloads.

def normalize_greenhouse(entry: dict, data: dict) -> list[dict]:
    company = entry["company"]
    slug = entry["slug"]
    out = []
    for j in data.get("jobs", []):
        loc = j.get("location") or {}
        out.append({
            "id": f"greenhouse:{slug}:{j.get('id')}",
            "source": "greenhouse",
            "title": j.get("title") or "",
            "company": company,
            "location": loc.get("name") if isinstance(loc, dict) else None,
            "url": j.get("absolute_url") or "",
            "logo": None,  # greenhouse boards carry no company-logo field
            "contact": None,
            "posted_at": _iso_date(j.get("updated_at")),
            "salary": None,  # greenhouse board JSON carries no pay field
            "description": strip_html(j.get("content")),
        })
    return out


def normalize_lever(entry: dict, data: list) -> list[dict]:
    company = entry["company"]
    slug = entry["slug"]
    out = []
    for j in data:
        cats = j.get("categories") or {}
        out.append({
            "id": f"lever:{slug}:{j.get('id')}",
            "source": "lever",
            "title": j.get("text") or "",
            "company": company,
            "location": cats.get("location") if isinstance(cats, dict) else None,
            "url": j.get("hostedUrl") or j.get("applyUrl") or "",
            "logo": None,  # lever postings carry no company-logo field
            "contact": None,
            "posted_at": _ms_epoch_to_iso(j.get("createdAt")),
            "salary": None,  # lever postings carry no structured pay field
            # descriptionPlain is already text; fall back to stripping HTML.
            "description": j.get("descriptionPlain") or strip_html(j.get("description")),
        })
    return out


def normalize_ashby(entry: dict, data: dict) -> list[dict]:
    company = entry["company"]
    slug = entry["slug"]
    out = []
    for j in data.get("jobs", []):
        # location is usually a plain string here, but guard against a dict shape.
        loc = j.get("location")
        if isinstance(loc, dict):
            loc = loc.get("name") or loc.get("locationName")
        out.append({
            "id": f"ashby:{slug}:{j.get('id')}",
            "source": "ashby",
            "title": j.get("title") or "",
            "company": company,
            "location": loc,
            "url": j.get("jobUrl") or j.get("applyUrl") or "",
            "logo": None,  # ashby boards carry no company-logo field
            "contact": None,
            "posted_at": _iso_date(j.get("publishedAt") or j.get("publishedDate")),
            # compensation is fetched with includeCompensation=false, so no pay field.
            "salary": None,
            "description": j.get("descriptionPlain") or strip_html(j.get("descriptionHtml")),
        })
    return out


def normalize_workday(entry: dict, data: dict) -> list[dict]:
    # Workday is per-tenant and messy (each company has its own host + endpoint shape
    # under /wday/cxs/<tenant>/<site>/jobs, POST-based). Deliberately a stub: callers
    # get an empty list so a watchlist workday entry never crashes the run. Implement
    # per-tenant later if needed; greenhouse/lever/ashby are the priority.
    log.info("workday is not implemented; skipping %s", entry.get("company"))
    return []


# --- fetchers (I/O) -------------------------------------------------------

_GREENHOUSE_URL = "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
_LEVER_URL = "https://api.lever.co/v0/postings/{slug}?mode=json"
_ASHBY_URL = "https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=false"

# platform -> (url template, normalizer). workday handled separately (no fetch).
_PLATFORMS = {
    "greenhouse": (_GREENHOUSE_URL, normalize_greenhouse),
    "lever": (_LEVER_URL, normalize_lever),
    "ashby": (_ASHBY_URL, normalize_ashby),
}


def _fetch_one(client: httpx.Client, entry: dict) -> list[dict]:
    platform = (entry.get("platform") or "").lower()
    slug = entry.get("slug")
    if not platform or not slug:
        log.warning("watchlist entry missing platform/slug: %r", entry)
        return []

    if platform == "workday":
        return normalize_workday(entry, {})

    spec = _PLATFORMS.get(platform)
    if spec is None:
        log.warning("unknown platform %r for %s", platform, entry.get("company"))
        return []

    url_tmpl, normalizer = spec
    resp = client.get(url_tmpl.format(slug=slug))
    resp.raise_for_status()
    return normalizer(entry, resp.json())


def load_watchlist(path: Path = WATCHLIST_PATH) -> list[dict]:
    """Read watchlist.json, dropping note entries (the {"_note": ...} marker and any
    key-only/underscore entries) so only real {company, platform, slug} rows remain."""
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    entries = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        if "company" in item and "platform" in item and "slug" in item:
            entries.append(item)
    return entries


def fetch() -> list[dict]:
    """Fetch and normalize every watchlist company. Per-company failures are logged
    and skipped so one bad board never aborts the whole run."""
    try:
        entries = load_watchlist()
    except (OSError, json.JSONDecodeError) as e:
        log.error("could not load watchlist: %s", e)
        return []

    jobs: list[dict] = []
    with httpx.Client(timeout=TIMEOUT, headers=HEADERS, follow_redirects=True) as client:
        for entry in entries:
            company = entry.get("company", "?")
            try:
                got = _fetch_one(client, entry)
                log.info("%s (%s): %d jobs", company, entry.get("platform"), len(got))
                jobs.extend(got)
            except httpx.HTTPError as e:
                log.warning("fetch failed for %s: %s", company, e)
            except (ValueError, KeyError) as e:
                log.warning("parse failed for %s: %s", company, e)
    return jobs


# --- tests ----------------------------------------------------------------

_REQUIRED_KEYS = {
    "id", "source", "title", "company", "location",
    "url", "logo", "contact", "posted_at", "salary", "description",
}


def _check_shape(job: dict, expected_source: str):
    assert set(job.keys()) == _REQUIRED_KEYS, f"key mismatch: {sorted(job.keys())}"
    assert "discipline" not in job, "fetch() must not set discipline"
    assert isinstance(job["id"], str) and job["id"], "id must be a non-empty str"
    assert job["source"] == expected_source, job["source"]
    assert isinstance(job["title"], str)
    assert isinstance(job["company"], str)
    assert job["location"] is None or isinstance(job["location"], str)
    assert isinstance(job["url"], str)
    assert job["logo"] is None, "logo must be None for ATS feeds"
    assert job["contact"] is None, "contact must be None for ATS feeds"
    assert job["posted_at"] is None or isinstance(job["posted_at"], str)
    assert job["salary"] is None, "salary must be None for ATS feeds"
    assert isinstance(job["description"], str)


def _run_offline_tests():
    # strip_html: tags gone, entities decoded, words kept separate.
    s = strip_html("<p>Hello&nbsp;<b>world</b></p><div>Design&amp;Build</div>")
    assert "Hello" in s and "world" in s and "Design&Build" in s, s
    assert "<" not in s and ">" not in s, s
    assert strip_html(None) == "" and strip_html("") == ""

    # epoch + iso date helpers
    assert _ms_epoch_to_iso(1773335421350) == "2026-03-12", _ms_epoch_to_iso(1773335421350)
    assert _ms_epoch_to_iso(None) is None
    assert _ms_epoch_to_iso("notnum") is None
    assert _iso_date("2026-04-17T12:25:57-04:00") == "2026-04-17"
    assert _iso_date(None) is None

    gh = normalize_greenhouse(
        {"company": "Figma", "slug": "figma"},
        {"jobs": [{
            "id": 4321, "title": "Product Designer",
            "absolute_url": "https://boards.greenhouse.io/figma/jobs/4321",
            "location": {"name": "Remote"}, "updated_at": "2026-04-17T12:25:57-04:00",
            "content": "&lt;p&gt;Craft &lt;b&gt;delightful&lt;/b&gt; UI&lt;/p&gt;",
        }]},
    )
    assert len(gh) == 1
    _check_shape(gh[0], "greenhouse")
    assert gh[0]["id"] == "greenhouse:figma:4321"
    assert gh[0]["location"] == "Remote"
    assert gh[0]["posted_at"] == "2026-04-17"
    # greenhouse content arrives double-encoded; one decode pass yields tags, the
    # extractor strips them, so the body must be clean text.
    assert "delightful" in gh[0]["description"] and "<" not in gh[0]["description"], gh[0]["description"]

    lv = normalize_lever(
        {"company": "Spotify", "slug": "spotify"},
        [{
            "id": "abc-123", "text": "Senior Product Designer",
            "hostedUrl": "https://jobs.lever.co/spotify/abc-123",
            "categories": {"location": "Stockholm"}, "createdAt": 1773335421350,
            "descriptionPlain": "Design things end to end.",
        }],
    )
    assert len(lv) == 1
    _check_shape(lv[0], "lever")
    assert lv[0]["id"] == "lever:spotify:abc-123"
    assert lv[0]["location"] == "Stockholm"
    assert lv[0]["posted_at"] == "2026-03-12"
    assert lv[0]["description"] == "Design things end to end."

    # lever entry with no descriptionPlain falls back to stripping HTML description.
    lv2 = normalize_lever(
        {"company": "Spotify", "slug": "spotify"},
        [{"id": "x", "text": "Designer", "hostedUrl": "u",
          "categories": {}, "createdAt": None,
          "description": "<p>HTML&amp;only</p>"}],
    )
    assert lv2[0]["location"] is None and lv2[0]["posted_at"] is None
    assert lv2[0]["description"] == "HTML&only", lv2[0]["description"]

    ash = normalize_ashby(
        {"company": "Linear", "slug": "Linear"},
        {"jobs": [{
            "id": "d3bc", "title": "Brand Designer", "location": "Europe",
            "jobUrl": "https://jobs.ashbyhq.com/Linear/d3bc",
            "applyUrl": "https://jobs.ashbyhq.com/Linear/d3bc/application",
            "publishedAt": "2021-04-27T20:13:45.158+00:00", "publishedDate": None,
            "descriptionPlain": "Own the brand system.",
            "descriptionHtml": "<p>Own the brand system.</p>",
        }]},
    )
    assert len(ash) == 1
    _check_shape(ash[0], "ashby")
    assert ash[0]["id"] == "ashby:Linear:d3bc"
    assert ash[0]["url"].endswith("/d3bc")  # jobUrl preferred over applyUrl
    assert ash[0]["location"] == "Europe"
    assert ash[0]["posted_at"] == "2021-04-27"
    assert ash[0]["description"] == "Own the brand system."

    # ashby missing publishedAt falls back to publishedDate; dict location handled.
    ash2 = normalize_ashby(
        {"company": "Linear", "slug": "Linear"},
        {"jobs": [{"id": "z", "title": "Designer",
                   "location": {"name": "Remote"}, "applyUrl": "u",
                   "publishedDate": "2026-01-02",
                   "descriptionHtml": "<div>Plain<br>text</div>"}]},
    )
    assert ash2[0]["location"] == "Remote"
    assert ash2[0]["url"] == "u"  # only applyUrl present
    assert ash2[0]["posted_at"] == "2026-01-02"
    assert "Plain" in ash2[0]["description"] and "<" not in ash2[0]["description"]

    # workday is a stub: always empty, never raises.
    assert normalize_workday({"company": "X"}, {}) == []

    # load_watchlist drops the _note marker and keeps only real rows.
    real = load_watchlist()
    assert all({"company", "platform", "slug"} <= set(e) for e in real), real
    assert all(not any(k.startswith("_") for k in e) for e in real)
    assert len(real) >= 3, "expected several starter entries"

    print("ats tests OK")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    _run_offline_tests()

    # Live, best-effort: only meaningful with network. Per-company counts are logged
    # inside fetch(); here we print the rollup.
    try:
        results = fetch()
        by_company: dict[str, int] = {}
        for job in results:
            by_company[job["company"]] = by_company.get(job["company"], 0) + 1
        print(f"live fetch: {len(results)} jobs total")
        for name, n in sorted(by_company.items()):
            print(f"  {name}: {n}")
        if not results:
            print("live fetch returned 0 jobs (network may be unavailable or boards empty)")
    except Exception as e:  # noqa: BLE001 - live probe must never mask offline pass
        print(f"live fetch skipped: {type(e).__name__}: {e}")
