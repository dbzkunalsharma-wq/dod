"use client";

import clsx from "clsx";
import {
  applyMailtoHref,
  applyNote,
  contactHref,
  DISCIPLINE_MAP,
  isEmailContact,
  isPhoneContact,
} from "@/lib/jobs";
import type { Job } from "@/lib/types";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";
import {
  CheckIcon,
  CopyIcon,
  MailIcon,
  PhoneIcon,
  SparkleIcon,
  WhatsAppIcon,
} from "./icons";

/**
 * Modal apply-assist block:
 *  - Surfaces `job.contact` prominently (email → mailto, phone → tel,
 *    wa.me/WhatsApp → link, Telegram handle → t.me).
 *  - "Copy note" copies a tailored, template-based cold-outreach note.
 *  - When the contact is an email, also offers "Email with note" — a mailto:
 *    with the subject + note prefilled. Template-only; no AI / API.
 */
export function ApplyAssist({ job }: { job: Job }) {
  const meta = DISCIPLINE_MAP[job.discipline];
  const { copied, copy } = useCopyToClipboard();

  const contact = job.contact?.trim() || null;
  const cHref = contact ? contactHref(contact) : null;
  const email = isEmailContact(contact);
  const phone = isPhoneContact(contact);
  const wa = !!contact && /wa\.me\/|whatsapp/i.test(contact);
  const mailtoNote = applyMailtoHref(job);

  const ContactIcon = email
    ? MailIcon
    : phone
      ? PhoneIcon
      : wa
        ? WhatsAppIcon
        : MailIcon;

  const contactKind = email
    ? "Email"
    : phone
      ? "Call"
      : wa
        ? "WhatsApp"
        : "Contact";

  return (
    <div className="mt-5 rounded-2xl border border-[var(--silver-line)] bg-white/[0.04] p-4">
      <div className="flex items-center gap-2">
        <SparkleIcon className={clsx("h-4 w-4", meta.text)} />
        <h3 className="text-sm font-semibold text-white">Apply assist</h3>
      </div>

      {/* prominent contact */}
      {contact && (
        <div className="mt-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">
            {contactKind}
          </span>
          <div className="mt-1 flex items-center gap-2">
            <ContactIcon className="h-4 w-4 shrink-0 text-white/45" />
            {cHref ? (
              <a
                href={cHref}
                target={cHref.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={clsx(
                  "break-all text-sm font-medium underline decoration-dotted underline-offset-2 transition-colors hover:text-white",
                  meta.text
                )}
              >
                {contact}
              </a>
            ) : (
              <span className="break-all text-sm font-medium text-white/80">
                {contact}
              </span>
            )}
          </div>
        </div>
      )}

      {/* actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(applyNote(job))}
          aria-label="Copy a tailored outreach note to the clipboard"
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            copied
              ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
              : "border-[var(--silver-line)] bg-white/[0.05] text-white/75 hover:border-white/30 hover:bg-white/[0.1] hover:text-white"
          )}
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5" />
          ) : (
            <CopyIcon className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied note" : "Copy note"}
        </button>

        {mailtoNote && (
          <a
            href={mailtoNote}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200",
              "border-[var(--silver-line)] bg-white/[0.05] text-white/75 hover:border-white/30 hover:bg-white/[0.1] hover:text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            )}
          >
            <MailIcon className="h-3.5 w-3.5" />
            Email with note
          </a>
        )}
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-white/40">
        A ready-to-edit template — personalise it before you send.
      </p>
    </div>
  );
}
