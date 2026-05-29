import html
from datetime import datetime, timezone

from telegram import Bot
from telegram.constants import ParseMode
from telegram.error import Forbidden, TelegramError

import db
import disciplines


SOURCE_LABELS = {
    "greenhouse": "Greenhouse",
    "lever": "Lever",
    "ashby": "Ashby",
    "workday": "Workday",
    "telegram": "Telegram",
    "linkedin": "LinkedIn",
    "unstop": "Unstop",
    "remoteok": "RemoteOK",
    "internshala": "Internshala",
    "foundit": "Foundit",
    "shine": "Shine",
    "dribbble": "Dribbble",
    "behance": "Behance",
    "apna": "Apna",
}


def _e(value) -> str:
    return html.escape(str(value))


def _parse_time(value):
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def relative_time(value) -> str:
    """Human 'just now / 3h ago / 5d ago' from an ISO date or datetime (treated as UTC)."""
    dt = _parse_time(value)
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    seconds = (datetime.now(timezone.utc) - dt).total_seconds()
    if seconds < 0:
        seconds = 0
    minutes, hours, days = seconds / 60, seconds / 3600, seconds / 86400
    if seconds < 90:
        return "just now"
    if minutes < 60:
        return f"{int(minutes)}m ago"
    if hours < 24:
        return f"{int(hours)}h ago"
    if days < 7:
        return f"{int(days)}d ago"
    if days < 35:
        return f"{int(days / 7)}w ago"
    return dt.date().isoformat()


def format_job(job) -> str:
    lines = [f"<b>{_e(job.get('title') or '(untitled role)')}</b>"]

    head = []
    if job.get("company"):
        head.append(_e(job["company"]))
    if job.get("discipline"):
        head.append(f"[{_e(disciplines.label(job['discipline']))}]")
    if head:
        lines.append(" — ".join(head))

    meta = []
    if job.get("location"):
        meta.append(_e(job["location"]))
    if job.get("source"):
        meta.append(_e(SOURCE_LABELS.get(job["source"], job["source"])))
    when = relative_time(job.get("posted_at") or job.get("seen_at"))
    if when:
        meta.append(when)
    if meta:
        lines.append(" · ".join(meta))

    if job.get("contact"):
        lines.append(f"Contact: {_e(job['contact'])}")
    if job.get("url"):
        lines.append(f'<a href="{_e(job["url"])}">Apply</a>')
    return "\n".join(lines)


async def broadcast_job(bot: Bot, job) -> int:
    """Send one job to every subscriber of its discipline. Returns how many were reached."""
    text = format_job(job)
    sent = 0
    for chat_id in db.subscribers_for(job.get("discipline")):
        try:
            await bot.send_message(chat_id, text, parse_mode=ParseMode.HTML)
            sent += 1
        except Forbidden:
            db.remove_subscriber(chat_id)
        except TelegramError:
            pass
    return sent
