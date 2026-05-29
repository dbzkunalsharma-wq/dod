"""Telegram public-channel job source for DOD.

Reads recent messages from public Telegram channels (a big surface for Indian
off-campus design hiring, where contact info is posted inline) and returns RAW
job-posting dicts. The classifier assigns "discipline" later, so this module
never sets it. fetch() is defensive: missing creds or a bad channel must never
raise, because the poller calls it on every cycle, even before setup.

Public contract:
    fetch() -> list[dict]
"""

import json
import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv

# Telethon is installed separately by the lead. Keep the pure helpers and the
# unit tests importable even if it is missing, so this file runs standalone.
try:
    from telethon.sync import TelegramClient

    _TELETHON_OK = True
except Exception:  # noqa: BLE001 - any import-time failure should degrade, not crash
    TelegramClient = None
    _TELETHON_OK = False

log = logging.getLogger("dod")

_DIR = Path(__file__).resolve().parent.parent  # D:\dod
load_dotenv(_DIR / ".env")

CHANNELS_PATH = _DIR / "channels.json"
SESSION_PATH = _DIR / ".telegram.session"

MESSAGE_LIMIT = 50  # recent messages to scan per channel
MAX_AGE_DAYS = 7

# Loose pre-filter only; the classifier makes the final design/not-design call.
_JOB_HINTS = re.compile(
    r"\b("
    r"hiring|we'?re hiring|job|jobs|vacancy|vacancies|opening|openings|opportunity|"
    r"role|position|apply|recruit|recruiting|freelance|intern|internship|"
    r"designer|design|ux|ui|product|graphic|motion|illustrat|brand|visual|creative|"
    r"experience required|years of experience|share (your )?cv|share (your )?resume|portfolio"
    r")\b",
    re.IGNORECASE,
)

# --- contact / url extraction patterns -------------------------------------
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_URL_RE = re.compile(r"https?://[^\s<>()\]\[]+", re.IGNORECASE)
# wa.me / t.me links (often the application route in Indian posts).
_WA_TME_RE = re.compile(r"(?:https?://)?(?:wa\.me|t\.me)/[^\s<>()\]\[]+", re.IGNORECASE)
# International phone, e.g. +91 98765 43210 / +91-98765-43210. Require a leading
# "+" and >=10 digits to avoid matching plain numbers like years or salaries.
_PHONE_RE = re.compile(r"\+\d[\d\s\-]{8,}\d")
# @handle (Telegram/Instagram style). Disallow a leading word char so we don't
# clip the local part of an email address.
_HANDLE_RE = re.compile(r"(?<![\w@.])@[A-Za-z][A-Za-z0-9_]{3,}")


def extract_url(text: str) -> str | None:
    """First http(s) link in the text, else None."""
    if not text:
        return None
    m = _URL_RE.search(text)
    return m.group(0).rstrip(".,);]") if m else None


def extract_contact(text: str) -> str | None:
    """Best application route: first of email / wa.me|t.me link / +phone / @handle.

    Ordered by how actionable each is for a candidate. Email first because it is
    the most common and unambiguous; a plain @handle is the weakest signal so it
    is last.
    """
    if not text:
        return None
    m = _EMAIL_RE.search(text)
    if m:
        return m.group(0).rstrip(".,);]")
    m = _WA_TME_RE.search(text)
    if m:
        return m.group(0).rstrip(".,);]")
    m = _PHONE_RE.search(text)
    if m:
        return re.sub(r"\s+", " ", m.group(0)).strip()
    m = _HANDLE_RE.search(text)
    if m:
        return m.group(0)
    return None


def first_meaningful_line(text: str) -> str:
    """Best-effort role title: the first non-empty, non-decorative line.

    Skips blank lines and lines that are only emoji/punctuation/symbols (common
    decorative headers like a row of arrows). Truncates very long lines so a
    whole paragraph never becomes the title.
    """
    if not text:
        return ""
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if not re.search(r"[A-Za-z0-9]", line):  # decorative-only line
            continue
        line = line.lstrip("#*>-•").strip()
        if not line:
            continue
        return line[:120].strip()
    return text.strip()[:120]


def looks_like_job(text: str) -> bool:
    return bool(text) and bool(_JOB_HINTS.search(text))


_COMPANY_RE = re.compile(
    r"\b(?:at|@|company|for)\s*[:\-]?\s*([A-Z][A-Za-z0-9&.\- ]{1,40})"
)


def extract_company(text: str) -> str | None:
    """Very loose company guess (e.g. 'Hiring at Acme Studio'). None if unsure."""
    if not text:
        return None
    m = _COMPANY_RE.search(text)
    if not m:
        return None
    name = m.group(1).strip(" .-")
    # Drop trailing role/connective words the regex may have greedily grabbed.
    name = re.split(
        r"\s+(?:is|are|for|to|we|hiring|location|based)\b", name, maxsplit=1,
        flags=re.IGNORECASE,
    )[0].strip()
    return name or None


def _channel_name(entry: str) -> str | None:
    """Normalise a channels.json entry to a bare username Telethon can resolve."""
    if not entry or not isinstance(entry, str):
        return None
    s = entry.strip()
    s = re.sub(r"^https?://", "", s, flags=re.IGNORECASE)
    s = re.sub(r"^t\.me/", "", s, flags=re.IGNORECASE)
    s = s.lstrip("@").strip("/")
    # Skip private invite links and joinchat handles we cannot read anonymously.
    if not s or s.startswith("+") or s.lower().startswith("joinchat"):
        return None
    return s


def _load_channels() -> list[str]:
    try:
        data = json.loads(CHANNELS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        log.warning("telegram_source: %s not found; no channels to read.", CHANNELS_PATH)
        return []
    except (json.JSONDecodeError, OSError) as e:
        log.warning("telegram_source: could not read channels.json (%s).", e)
        return []

    raw = data.get("channels", []) if isinstance(data, dict) else data
    names = []
    for entry in raw or []:
        name = _channel_name(entry)
        if name:
            names.append(name)
    return names


def _to_job(channel: str, msg) -> dict | None:
    """Map a Telethon Message to a RAW job dict, or None to skip."""
    text = (getattr(msg, "message", None) or "").strip()
    if not looks_like_job(text):
        return None
    posted_at = None
    if getattr(msg, "date", None) is not None:
        # Telethon dates are tz-aware UTC datetimes.
        posted_at = msg.date.date().isoformat()
    return {
        "id": f"telegram:{channel}:{msg.id}",
        "source": "telegram",
        "title": first_meaningful_line(text),
        "company": extract_company(text),
        "location": None,  # rarely structured in chat posts; classifier may infer
        "url": extract_url(text),
        "contact": extract_contact(text),
        "posted_at": posted_at,
        "description": text,
    }


def fetch() -> list[dict]:
    """Read recent messages from the configured public channels.

    Returns RAW job dicts (no 'discipline'). Never raises: any failure is logged
    and yields whatever was gathered so far (possibly an empty list).
    """
    api_id = (os.environ.get("TELEGRAM_API_ID") or "").strip()
    api_hash = (os.environ.get("TELEGRAM_API_HASH") or "").strip()
    if not api_id or not api_hash:
        log.warning(
            "telegram_source: TELEGRAM_API_ID/TELEGRAM_API_HASH not set; "
            "returning no jobs. Get them from https://my.telegram.org and add "
            "them to D:\\dod\\.env."
        )
        return []
    if not _TELETHON_OK:
        log.warning("telegram_source: telethon is not installed; returning no jobs.")
        return []
    try:
        api_id_int = int(api_id)
    except ValueError:
        log.warning("telegram_source: TELEGRAM_API_ID must be an integer; returning no jobs.")
        return []

    channels = _load_channels()
    if not channels:
        return []

    # Imported lazily so the missing-dep path above stays import-safe.
    from datetime import datetime, timedelta, timezone

    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)

    jobs: list[dict] = []
    try:
        # str(SESSION_PATH) without the .session suffix is what Telethon expects.
        session = str(SESSION_PATH)
        if session.endswith(".session"):
            session = session[: -len(".session")]
        with TelegramClient(session, api_id_int, api_hash) as client:
            for channel in channels:
                try:
                    for msg in client.iter_messages(channel, limit=MESSAGE_LIMIT):
                        if getattr(msg, "date", None) and msg.date < cutoff:
                            break  # messages are newest-first; older ones follow
                        job = _to_job(channel, msg)
                        if job:
                            jobs.append(job)
                except Exception as e:  # noqa: BLE001 - one bad channel must not kill the rest
                    log.warning("telegram_source: skipping channel %s (%s).", channel, e)
    except Exception as e:  # noqa: BLE001 - auth/network/login failures must not raise
        log.warning("telegram_source: fetch aborted (%s). Returning %d job(s).", e, len(jobs))

    return jobs


def _run_tests() -> None:
    """Unit-test the pure helpers against inline sample messages.

    No network or creds required; safe to run even without telethon installed.
    """
    indian = (
        "Hiring UI/UX Designer. Share CV at hr@studio.com or WhatsApp +91 98765 43210"
    )
    assert extract_contact(indian) == "hr@studio.com"
    # Single-line post: the whole line is the title (contract: "first meaningful line").
    assert first_meaningful_line(indian) == indian
    assert looks_like_job(indian)
    assert extract_url(indian) is None

    # Multi-line post: only the first meaningful line becomes the title.
    indian_multiline = (
        "Hiring UI/UX Designer\nStudio XYZ, Bengaluru\nShare CV at hr@studio.com"
    )
    assert first_meaningful_line(indian_multiline) == "Hiring UI/UX Designer"
    assert extract_contact(indian_multiline) == "hr@studio.com"

    phone_only = "We are hiring a Motion Designer. Call +91-98765-43210 to apply."
    assert extract_contact(phone_only) == "+91-98765-43210"

    wa_link = "Graphic Designer needed. Apply: https://wa.me/919876543210 now"
    assert extract_contact(wa_link) == "https://wa.me/919876543210"
    assert extract_url(wa_link) == "https://wa.me/919876543210"

    handle_only = "Product Designer role open. DM @design_studio for details."
    assert extract_contact(handle_only) == "@design_studio"

    url_post = (
        "Senior Visual Designer\nAcme Labs is hiring.\n"
        "Details: https://acme.example.com/careers/42 (apply soon)"
    )
    assert extract_url(url_post) == "https://acme.example.com/careers/42"
    assert first_meaningful_line(url_post) == "Senior Visual Designer"
    # No explicit "at/for/@ <Name>" trigger here, so company stays None on purpose
    # (the extractor is deliberately conservative to avoid bogus company names).
    assert extract_company(url_post) is None
    # Explicit trigger word -> company is detected.
    assert extract_company("Hiring at Acme Studio for a UI role") == "Acme Studio"

    decorative = ">>>>>>\n\nIllustrator wanted at Pixel Co.\nEmail jobs@pixel.co"
    assert first_meaningful_line(decorative) == "Illustrator wanted at Pixel Co."
    assert extract_contact(decorative) == "jobs@pixel.co"

    # Email must win even when an @handle is also present.
    mixed = "UX Researcher. Mail careers@acme.io or ping @acme_hr"
    assert extract_contact(mixed) == "careers@acme.io"

    # Non-job chatter should be filtered out by the loose pre-filter.
    assert not looks_like_job("Good morning everyone, happy Friday!")

    # Empty / None inputs must be safe.
    assert extract_contact("") is None
    assert extract_url("") is None
    assert first_meaningful_line("") == ""
    assert extract_company("") is None

    # Channel-entry normalisation.
    assert _channel_name("@designjobs") == "designjobs"
    assert _channel_name("https://t.me/uxjobs") == "uxjobs"
    assert _channel_name("t.me/creativejobs/") == "creativejobs"
    assert _channel_name("https://t.me/+privatehash") is None
    assert _channel_name("") is None

    print("telegram_source tests OK")


if __name__ == "__main__":
    _run_tests()
