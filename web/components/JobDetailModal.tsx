"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { DISCIPLINE_MAP, isNew, postedAgo, sourceLabel } from "@/lib/jobs";
import type { Job } from "@/lib/types";
import { useNow } from "@/lib/useRelativeTime";
import { useTracker } from "@/lib/useTracker";
import { ApplyAssist } from "./ApplyAssist";
import { CopyJobLinkButton } from "./board-controls";
import { CompanyAvatar } from "./CompanyAvatar";
import { DisciplineBadge } from "./DisciplineBadge";
import { ArrowUpRightIcon, CloseIcon, PinIcon } from "./icons";
import {
  NewBadge,
  SalaryChip,
  SaveButton,
  StatusSelector,
} from "./tracker-ui";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function JobDetailModal({
  job,
  onClose,
}: {
  /** The job to show, or null when the modal is closed. */
  job: Job | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  // The element that had focus before opening — focus returns here on close.
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const { isSaved, statusOf, toggleSave, setStatus } = useTracker();
  const now = useNow();

  const open = job !== null;

  /* ---- body scroll lock + remember the trigger to restore focus to ---- */
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    // Compensate for the scrollbar so the page doesn't shift on lock.
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (sbw > 0) body.style.paddingRight = `${sbw}px`;

    // Move focus into the dialog (the close button).
    closeBtnRef.current?.focus();

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
      // Restore focus to the trigger element on close.
      restoreRef.current?.focus?.();
    };
  }, [open]);

  /* ---- key handling: Esc to close, Tab focus-trap ---- */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open || !job) return null;

  const meta = DISCIPLINE_MAP[job.discipline];
  const description = job.description?.trim();

  return (
    <div
      className="dod-modal-overlay fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      // Backdrop click closes; clicks inside the panel are stopped below.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* dim + blur scrim */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          "dod-glass dod-glass--silver dod-modal-panel relative flex max-h-[92dvh] w-full max-w-2xl flex-col",
          "rounded-t-3xl sm:rounded-3xl"
        )}
      >
        {/* accent top-line echoing the card */}
        <span
          aria-hidden="true"
          className={clsx(
            "pointer-events-none absolute inset-x-0 top-0 h-[3px] rounded-t-3xl",
            meta.topLine
          )}
        />

        {/* close */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={clsx(
            "absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full",
            "border border-white/15 bg-white/[0.06] text-white/70 transition-colors",
            "hover:bg-white/[0.14] hover:text-white",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          )}
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        {/* scrollable content */}
        <div className="dod-modal-scroll flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-7 sm:px-8 sm:pb-8">
          <div className="flex items-start gap-4 pr-10">
            <CompanyAvatar
              company={job.company}
              logo={job.logo}
              discipline={job.discipline}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <DisciplineBadge discipline={job.discipline} />
                {now !== null && isNew(job, now) && <NewBadge />}
              </div>
              <h2
                id={titleId}
                className="mt-2 text-balance text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl"
              >
                {job.title}
              </h2>
              {job.company && (
                <p className="mt-1 text-sm font-medium text-white/75">
                  {job.company}
                </p>
              )}
            </div>
            <SaveButton
              saved={isSaved(job.id)}
              onToggle={() => toggleSave(job.id)}
              label={job.title}
              size="lg"
              className="mt-0.5"
            />
          </div>

          {/* meta row */}
          <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/60">
            {job.location && (
              <>
                <span className="inline-flex items-center gap-1">
                  <PinIcon className="h-3.5 w-3.5 text-white/45" />
                  {job.location}
                </span>
                <span className="text-white/25" aria-hidden="true">
                  ·
                </span>
              </>
            )}
            <span>{sourceLabel(job.source)}</span>
            <span className="text-white/25" aria-hidden="true">
              ·
            </span>
            <span className="text-white/45">{postedAgo(job)}</span>
          </div>

          {/* salary + status row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {job.salary?.trim() && <SalaryChip salary={job.salary.trim()} />}
            <StatusSelector
              value={statusOf(job.id)}
              onChange={(s) => setStatus(job.id, s)}
              label={job.title}
            />
          </div>

          {/* apply assist — prominent contact + template outreach note */}
          <ApplyAssist job={job} />

          {/* description */}
          <div className="mt-5 border-t border-white/10 pt-5">
            {description ? (
              <p
                id={descId}
                className="whitespace-pre-wrap text-sm leading-relaxed text-white/75"
              >
                {description}
              </p>
            ) : (
              <p className="text-sm italic text-white/45">
                No description was provided for this role. Open the original
                posting for full details.
              </p>
            )}
          </div>
        </div>

        {/* sticky action footer */}
        <div className="dod-glass--silver-edge flex shrink-0 items-center gap-2 border-t border-white/10 px-6 py-4 sm:px-8">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
              "group/apply relative inline-flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl",
              "border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white",
              "transition-all duration-200 hover:border-transparent",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]"
            )}
            aria-label={`Apply to ${job.title}${
              job.company ? ` at ${job.company}` : ""
            } (opens in a new tab)`}
          >
            <span
              aria-hidden="true"
              className={clsx(
                "absolute inset-0 opacity-0 transition-opacity duration-200 group-hover/apply:opacity-100",
                meta.gradient
              )}
            />
            <span className="relative">Apply on {sourceLabel(job.source)}</span>
            <ArrowUpRightIcon className="relative h-4 w-4 transition-transform duration-200 group-hover/apply:translate-x-0.5 group-hover/apply:-translate-y-0.5" />
          </a>
          {/* additive: a permanent, crawlable detail page for this role */}
          <Link
            href={`/jobs/${encodeURIComponent(job.id)}`}
            className={clsx(
              "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition-all duration-200",
              "border-white/10 bg-white/[0.06] text-white/75 hover:border-white/25 hover:bg-white/[0.12] hover:text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]"
            )}
            aria-label={`Open the full details page for ${job.title}`}
          >
            <ArrowUpRightIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Open page</span>
          </Link>
          <CopyJobLinkButton jobId={job.id} />
        </div>
      </div>
    </div>
  );
}
