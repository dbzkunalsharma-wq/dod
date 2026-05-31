r"""Slug-discovery probe: given a list of company names, find which public ATS board
(Greenhouse, Lever, Ashby, SmartRecruiters) each one publishes on, and what slug.

For every company we generate a handful of slug candidates from the name and try each
platform's PUBLIC list endpoint. A 200 response whose jobs/postings array is non-empty
is treated as a HIT; we stop at the first platform+slug hit per company. The point is to
grow watchlist.json without hand-checking 100+ careers pages.

Run:
    D:\dod\.venv\Scripts\python.exe D:\dod\probe_ats.py

Prints a JSON array of confirmed {company, platform, slug} (job_count logged to stderr)
plus a summary: X/N found, per-platform breakdown, and the companies with NO hit.
"""

import json
import re
import sys
import time

import httpx

# A real browser-ish UA: some ATS edges reject the default httpx UA outright.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}
TIMEOUT = 6.0
DELAY = 0.35  # polite pause between requests so we don't hammer any single host

# Companies to probe (STEP 3 list). The 14 already in watchlist.json are excluded
# by the caller-supplied dedup set below, but we keep this list standalone/complete.
COMPANIES = [
    "Razorpay", "Zomato", "Swiggy", "Flipkart", "Myntra", "Nykaa", "Lenskart",
    "Urban Company", "Zepto", "Blinkit", "Cars24", "Spinny", "CarDekho", "NoBroker",
    "Rebel Foods", "Licious", "Porter", "Delhivery", "Shiprocket", "Zetwerk",
    "OfBusiness", "Udaan", "Ninjacart", "Dream11", "Games24x7",
    "Mobile Premier League", "Unacademy", "PhysicsWallah", "upGrad", "Curefit",
    "HealthifyMe", "PharmEasy", "Tata 1mg", "Practo", "Pristyn Care", "Juspay",
    "Zeta", "Jupiter Money", "Fi Money", "Navi", "Cashfree", "Pine Labs",
    "BharatPe", "KreditBee", "smallcase", "INDmoney", "Dezerv", "Scaler", "Zoho",
    "Freshworks", "BrowserStack", "Chargebee", "Whatfix", "MoEngage", "CleverTap",
    "Hasura", "Atlan", "Yellow.ai", "Gupshup", "Exotel", "Innovaccer",
    "Mindtickle", "HighRadius", "Capillary Technologies", "Netcore", "Wingify",
    "Druva", "Icertis", "Sprinklr", "Rupeek", "Khatabook", "Vyapar",
    "Open Financial", "M2P Fintech", "Setu", "Plum", "Onsurity", "Jar", "Pixxel",
    "Skyroot", "Zolve", "Atlassian", "Stripe", "Notion", "Canva", "Miro",
    "Airbnb", "Uber", "Twilio", "Salesforce", "Intuit", "Adobe", "Microsoft",
    "Booking.com", "Walmart Global Tech", "Amazon", "Dropbox", "Pinterest",
    "Coinbase", "Plaid", "GitHub", "HashiCorp", "Databricks", "Snowflake",
    "Confluent", "MongoDB", "Elastic", "Zoom", "DoorDash", "Robinhood", "Brex",
    "Rippling", "Deel", "Webflow", "Vercel", "Retool", "Amplitude", "Asana",
    "Gojek", "Grab",
]

# Names already covered by watchlist.json — skip so we don't re-probe / duplicate.
ALREADY_IN_WATCHLIST = {
    "Figma", "Duolingo", "GitLab", "Postman", "Spotify", "CRED", "Linear",
    "Runway", "Ramp", "Groww", "PhonePe", "Slice", "Meesho", "Hevo Data",
}


def slug_candidates(name: str) -> list[str]:
    """Generate ordered, de-duplicated slug guesses for a company name.

    Covers the common ATS conventions: lowercase-nospace, lowercase-hyphen,
    lowercase-alnum-only, and first-word-lowercase. Order matters — earlier, more
    likely forms are tried first so a company resolves on its canonical slug.
    """
    lower = name.lower().strip()
    nospace = lower.replace(" ", "")
    hyphen = re.sub(r"\s+", "-", lower)
    nopunct = re.sub(r"[^a-z0-9]", "", lower)  # drop spaces AND punctuation (.,&)
    first_word = re.split(r"\s+", lower)[0] if lower else lower
    # nopunct-hyphen keeps word boundaries but strips dots like "yellow.ai"
    nopunct_words = re.sub(r"[^a-z0-9]+", " ", lower).strip()
    nopunct_hyphen = re.sub(r"\s+", "-", nopunct_words)

    cands = [nospace, hyphen, nopunct, nopunct_hyphen, first_word]
    seen: set[str] = set()
    out = []
    for c in cands:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def smartrecruiters_candidates(name: str) -> list[str]:
    """SmartRecruiters slugs are frequently PascalCase/nospace matching the brand
    (e.g. "Razorpay", "PineLabs"). Try those original-case forms first, then fall
    back to the generic lowercase candidates."""
    raw_nospace = re.sub(r"\s+", "", name.strip())            # "PineLabs"
    raw_alnum = re.sub(r"[^A-Za-z0-9]", "", name.strip())     # drop dots/&
    pascal = "".join(w[:1].upper() + w[1:] for w in re.split(r"\s+", name.strip()) if w)

    out: list[str] = []
    seen: set[str] = set()
    for c in [raw_nospace, raw_alnum, pascal, *slug_candidates(name)]:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


# --- per-platform "is this slug a live board?" probes ---------------------
# Each returns job_count (int) on a 200 + non-empty array, else None. Network/
# decode errors and 404/403/empty are swallowed and treated as "no hit".

def _get(client: httpx.Client, url: str):
    try:
        r = client.get(url)
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    try:
        return r.json()
    except (ValueError, json.JSONDecodeError):
        return None


def probe_greenhouse(client, slug):
    data = _get(client, f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs")
    if isinstance(data, dict):
        jobs = data.get("jobs")
        if isinstance(jobs, list) and jobs:
            return len(jobs)
    return None


def probe_lever(client, slug):
    data = _get(client, f"https://api.lever.co/v0/postings/{slug}?mode=json")
    if isinstance(data, list) and data:
        return len(data)
    return None


def probe_ashby(client, slug):
    data = _get(client, f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
    if isinstance(data, dict):
        jobs = data.get("jobs")
        if isinstance(jobs, list) and jobs:
            return len(jobs)
    return None


def probe_smartrecruiters(client, slug):
    data = _get(client, f"https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit=100")
    if isinstance(data, dict):
        content = data.get("content")
        if isinstance(content, list) and content:
            # prefer totalFound when present, else the page length
            return data.get("totalFound") or len(content)
    return None


# Probe order: India-heavy boards (greenhouse, lever) first, then ashby, then SR.
_PROBES = [
    ("greenhouse", probe_greenhouse, slug_candidates),
    ("lever", probe_lever, slug_candidates),
    ("ashby", probe_ashby, slug_candidates),
    ("smartrecruiters", probe_smartrecruiters, smartrecruiters_candidates),
]


def probe_company(client: httpx.Client, name: str):
    """Try every platform x candidate; return the first hit dict or None."""
    for platform, probe, cand_fn in _PROBES:
        for slug in cand_fn(name):
            count = probe(client, slug)
            time.sleep(DELAY)
            if count:
                return {"company": name, "platform": platform,
                        "slug": slug, "job_count": int(count)}
    return None


def main():
    targets = [c for c in COMPANIES if c not in ALREADY_IN_WATCHLIST]
    print(f"# probing {len(targets)} companies "
          f"({len(COMPANIES) - len(targets)} skipped as already in watchlist)...",
          file=sys.stderr)

    hits: list[dict] = []
    misses: list[str] = []
    with httpx.Client(timeout=TIMEOUT, headers=HEADERS, follow_redirects=True) as client:
        for i, name in enumerate(targets, 1):
            hit = probe_company(client, name)
            if hit:
                hits.append(hit)
                print(f"# [{i}/{len(targets)}] HIT  {name} -> "
                      f"{hit['platform']}:{hit['slug']} ({hit['job_count']} jobs)",
                      file=sys.stderr)
            else:
                misses.append(name)
                print(f"# [{i}/{len(targets)}] ----  {name}: no public ATS",
                      file=sys.stderr)

    # confirmed entries: watchlist shape only (drop job_count from the JSON array)
    confirmed = [{"company": h["company"], "platform": h["platform"], "slug": h["slug"]}
                 for h in hits]
    print(json.dumps(confirmed, indent=2, ensure_ascii=False))

    # --- summary to stderr -------------------------------------------------
    by_platform: dict[str, int] = {}
    for h in hits:
        by_platform[h["platform"]] = by_platform.get(h["platform"], 0) + 1
    print("\n# ===== SUMMARY =====", file=sys.stderr)
    print(f"# {len(hits)}/{len(targets)} probed companies resolved to a board "
          f"(of {len(COMPANIES)} in the full STEP-3 list)", file=sys.stderr)
    for plat, n in sorted(by_platform.items(), key=lambda kv: -kv[1]):
        print(f"#   {plat}: {n}", file=sys.stderr)
    print(f"# NO public ATS ({len(misses)}): {', '.join(misses)}", file=sys.stderr)


if __name__ == "__main__":
    main()
