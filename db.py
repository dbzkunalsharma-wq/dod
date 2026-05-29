import sqlite3
from contextlib import closing
from pathlib import Path

DB_PATH = Path(__file__).parent / "dod.db"


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    with closing(_conn()) as c, c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS subscribers (
                chat_id    INTEGER PRIMARY KEY,
                username   TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS subscriptions (
                chat_id    INTEGER,
                discipline TEXT,
                UNIQUE(chat_id, discipline)
            );
            CREATE TABLE IF NOT EXISTS jobs (
                id         TEXT PRIMARY KEY,
                source     TEXT,
                discipline TEXT,
                title      TEXT,
                company    TEXT,
                location   TEXT,
                url        TEXT,
                contact    TEXT,
                posted_at   TEXT,
                logo        TEXT,
                description TEXT,
                salary      TEXT,
                seen_at     TEXT DEFAULT (datetime('now'))
            );
            """
        )
        # migrate DBs created before these columns existed
        for col in ("logo", "description", "salary"):
            try:
                c.execute(f"ALTER TABLE jobs ADD COLUMN {col} TEXT")
            except sqlite3.OperationalError:
                pass


def add_subscriber(chat_id, username):
    with closing(_conn()) as c, c:
        c.execute(
            "INSERT INTO subscribers(chat_id, username) VALUES(?, ?) "
            "ON CONFLICT(chat_id) DO UPDATE SET username=excluded.username",
            (chat_id, username),
        )


def remove_subscriber(chat_id):
    with closing(_conn()) as c, c:
        c.execute("DELETE FROM subscriptions WHERE chat_id=?", (chat_id,))
        c.execute("DELETE FROM subscribers WHERE chat_id=?", (chat_id,))


def toggle_discipline(chat_id, discipline) -> bool:
    """Add the discipline if absent, remove it if present. Returns True if now subscribed."""
    with closing(_conn()) as c, c:
        exists = c.execute(
            "SELECT 1 FROM subscriptions WHERE chat_id=? AND discipline=?",
            (chat_id, discipline),
        ).fetchone()
        if exists:
            c.execute(
                "DELETE FROM subscriptions WHERE chat_id=? AND discipline=?",
                (chat_id, discipline),
            )
            return False
        c.execute(
            "INSERT OR IGNORE INTO subscriptions(chat_id, discipline) VALUES(?, ?)",
            (chat_id, discipline),
        )
        return True


def get_disciplines(chat_id) -> set:
    with closing(_conn()) as c:
        rows = c.execute(
            "SELECT discipline FROM subscriptions WHERE chat_id=?", (chat_id,)
        ).fetchall()
        return {r["discipline"] for r in rows}


def subscribers_for(discipline) -> list:
    with closing(_conn()) as c:
        rows = c.execute(
            "SELECT chat_id FROM subscriptions WHERE discipline=?", (discipline,)
        ).fetchall()
        return [r["chat_id"] for r in rows]


def save_job(job) -> bool:
    """Insert a job. Returns True if new, False if the id was already seen (dedup)."""
    fields = ("id", "source", "discipline", "title", "company", "location",
              "url", "contact", "posted_at", "logo", "description", "salary")
    with closing(_conn()) as c, c:
        try:
            c.execute(
                "INSERT INTO jobs(id, source, discipline, title, company, location, url, contact, posted_at, logo, description, salary) "
                "VALUES(:id, :source, :discipline, :title, :company, :location, :url, :contact, :posted_at, :logo, :description, :salary)",
                {k: job.get(k) for k in fields},
            )
            return True
        except sqlite3.IntegrityError:
            return False


def recent_jobs(discipline=None, limit=10):
    order = "ORDER BY COALESCE(posted_at, seen_at) DESC LIMIT ?"
    with closing(_conn()) as c:
        if discipline:
            rows = c.execute(
                f"SELECT * FROM jobs WHERE discipline=? {order}",
                (discipline, limit),
            ).fetchall()
        else:
            rows = c.execute(
                f"SELECT * FROM jobs {order}", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]
