import logging
import os

from dotenv import load_dotenv
from telegram import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    LinkPreviewOptions,
    Update,
)
from telegram.constants import ParseMode
from telegram.error import BadRequest
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
)

import db
import disciplines
from alerts import format_job

load_dotenv()
TOKEN = os.environ.get("BOT_TOKEN")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
log = logging.getLogger("dod")

WELCOME = (
    "I'm <b>DOD</b> — your design-opportunity hunter. I love to work, so you don't have to.\n\n"
    "I watch design roles across the web — UI/UX, Product, Communication, Industrial — "
    "and ping you the moment a fresh one lands, before it hits the big boards.\n\n"
    "Pick the disciplines you care about and I'll send only those."
)


def disciplines_keyboard(selected: set) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(
            f"{'[x]' if key in selected else '[  ]'} {disciplines.label(key)}",
            callback_data=f"tog:{key}",
        )]
        for key in disciplines.all_keys()
    ]
    rows.append([InlineKeyboardButton("Done", callback_data="done")])
    return InlineKeyboardMarkup(rows)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    user = update.effective_user
    db.add_subscriber(chat.id, user.username if user else None)
    await update.message.reply_text(
        WELCOME,
        parse_mode=ParseMode.HTML,
        reply_markup=disciplines_keyboard(db.get_disciplines(chat.id)),
    )


async def settings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Toggle the disciplines you want alerts for:",
        reply_markup=disciplines_keyboard(db.get_disciplines(update.effective_chat.id)),
    )


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        await query.answer()
    except BadRequest:
        return  # stale callback (tapped while the bot was offline); ignore
    chat_id = query.message.chat.id

    if query.data == "done":
        selected = db.get_disciplines(chat_id)
        if selected:
            names = ", ".join(
                disciplines.label(k) for k in disciplines.all_keys() if k in selected
            )
            await query.edit_message_text(
                f"You're set. I'll alert you for: <b>{names}</b>.\nUse /settings to change anytime.",
                parse_mode=ParseMode.HTML,
            )
        else:
            await query.edit_message_text(
                "No disciplines selected, so you won't get alerts. Use /settings to pick some."
            )
        return

    if query.data.startswith("tog:"):
        db.toggle_discipline(chat_id, query.data.split(":", 1)[1])
        await query.edit_message_reply_markup(
            reply_markup=disciplines_keyboard(db.get_disciplines(chat_id))
        )


async def stop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db.remove_subscriber(update.effective_chat.id)
    await update.message.reply_text(
        "Stopped — no more alerts. Send /start whenever you want me back to work."
    )


async def latest(update: Update, context: ContextTypes.DEFAULT_TYPE):
    disc = None
    if context.args and context.args[0].lower() in disciplines.all_keys():
        disc = context.args[0].lower()
    jobs = db.recent_jobs(disc, limit=12)
    if not jobs:
        await update.message.reply_text(
            "Nothing in the feed yet. New roles show up here as soon as the poller finds them — "
            "try /preview to see the format."
        )
        return
    scope = disciplines.label(disc) if disc else "all disciplines"
    header = f"<b>Latest design roles</b> ({scope}, newest first):"
    body = "\n\n".join(format_job(job) for job in jobs)
    await update.message.reply_text(
        f"{header}\n\n{body}",
        parse_mode=ParseMode.HTML,
        link_preview_options=LinkPreviewOptions(is_disabled=True),
    )


async def preview(update: Update, context: ContextTypes.DEFAULT_TYPE):
    sample = {
        "id": "sample-1",
        "source": "greenhouse",
        "discipline": "uiux",
        "title": "Product Designer (UI/UX)",
        "company": "Acme Studio",
        "location": "Bengaluru / Remote",
        "url": "https://example.com/jobs/123",
        "contact": "careers@acme.com",
        "posted_at": "2026-05-29",
    }
    await update.message.reply_text(format_job(sample), parse_mode=ParseMode.HTML)


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "DOD commands:\n"
        "/start — begin and pick disciplines\n"
        "/settings — change your disciplines\n"
        "/latest [discipline] — browse recent roles, newest first\n"
        "/preview — see a sample alert\n"
        "/stop — stop all alerts"
    )


async def _post_init(app: Application):
    await app.bot.set_my_commands([
        BotCommand("start", "Begin & pick disciplines"),
        BotCommand("settings", "Change your disciplines"),
        BotCommand("latest", "Browse recent roles, newest first"),
        BotCommand("preview", "See a sample alert"),
        BotCommand("stop", "Stop all alerts"),
    ])


async def on_error(update: object, context: ContextTypes.DEFAULT_TYPE):
    log.warning("handler error: %s", context.error)


def main():
    if not TOKEN:
        raise SystemExit(
            "BOT_TOKEN is missing. Copy .env.example to .env and paste your @BotFather token."
        )
    db.init()
    app = Application.builder().token(TOKEN).post_init(_post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("settings", settings))
    app.add_handler(CommandHandler("stop", stop))
    app.add_handler(CommandHandler("latest", latest))
    app.add_handler(CommandHandler("preview", preview))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_error_handler(on_error)
    log.info("DOD is up and polling. Press Ctrl+C to stop.")
    app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)


if __name__ == "__main__":
    main()
