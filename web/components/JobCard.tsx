"use client";

import clsx from "clsx";
import {
  contactHref,
  DISCIPLINE_MAP,
  isNew,
  postedAgo,
  sourceLabel,
} from "@/lib/jobs";
import type { Job } from "@/lib/types";
import { useNow } from "@/lib/useRelativeTime";
import { useTracker } from "@/lib/useTracker";
import { CompanyAvatar } from "./CompanyAvatar";
import { DisciplineBadge } from "./DisciplineBadge";
import { ArrowUpRightIcon, MailIcon, PinIcon } from "./icons";
import {
  NewBadge,
  SalaryChip,
  SaveButton,
  StatusSelector,
} from "./tracker-ui";

export function JobCard({
  job,
  index = 0,
  onOpen,
}: {
  job: Job;
  index?: number;
  /** Open the detail modal for this job (card click / Enter / Space). */
  onOpen: (job: Job) => void;
}) {
  const meta = DISCIPLINE_MAP[job.discipline];
  const cHref = job.contact ? contactHref(job.contact) : null;

  const { isSaved, statusOf, toggleSave, setStatus } = useTracker();
  const saved = isSaved(job.id);
  const status = statusOf(job.id);

  // Live "now" → null during SSR, so the NEW badge only appears post-hydration
  // (avoids a server/client mismatch on a time-dependent value).
  const now = useNow();
  const fresh = now !== null && isNew(job, now);

  const salary = job.salary?.trim();

  const open = () => onOpen(job);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`View details for ${job.title}${
        job.company ? ` at ${job.company}` : ""
      }`}
      onClick={open}
      onKeyDown={(e) => {
        // Activate on Enter/Space, but ignore keys bubbling up from the
        // inner Apply / contact / tracker controls (they handle themselves).
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          open();
        }
      }}
      className={clsx(
        "dod-rise dod-glass dod-glass--silver group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl p-5 text-left",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:bg-white/[0.09]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]",
        meta.hoverGlow
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      {/* discipline accent — gradient top-line */}
      <span
        aria-hidden="true"
        className={clsx(
          "absolute inset-x-0 top-0 h-[3px] opacity-80 transition-opacity duration-300 group-hover:opacity-100",
          meta.topLine
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <CompanyAvatar
          company={job.company}
          logo={job.logo}
          discipline={job.discipline}
          size="sm"
        />
        <div className="flex shrink-0 items-center gap-2">
          {fresh && <NewBadge />}
          <DisciplineBadge discipline={job.discipline} />
          <SaveButton
            saved={saved}
            onToggle={() => toggleSave(job.id)}
            label={job.title}
          />
        </div>
      </div>

      <h2 className="mt-3 text-balance text-lg font-semibold leading-snug tracking-tight text-white">
        {job.title}
      </h2>

      {job.company && (
        <p className="mt-1 text-sm font-medium text-white/70">{job.company}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/55">
        {job.location && (
          <>
            <span className="inline-flex items-center gap-1">
              <PinIcon className="h-3.5 w-3.5 text-white/40" />
              {job.location}
            </span>
            <span className="text-white/30" aria-hidden="true">
              ·
            </span>
          </>
        )}
        <span className="text-white/55">{sourceLabel(job.source)}</span>
        <span className="text-white/30" aria-hidden="true">
          ·
        </span>
        <span className="text-white/45">{postedAgo(job)}</span>
      </div>

      {salary && (
        <div className="mt-3">
          <SalaryChip salary={salary} />
        </div>
      )}

      {job.contact && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/55">
          <MailIcon className="h-3.5 w-3.5 text-white/40" />
          {cHref ? (
            <a
              href={cHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={clsx(
                "underline decoration-dotted underline-offset-2 transition-colors hover:text-white",
                meta.text
              )}
            >
              {job.contact}
            </a>
          ) : (
            <span className="text-white/70">{job.contact}</span>
          )}
        </div>
      )}

      {/* status selector — set interested / applied / rejected inline */}
      <div className="mt-4" onClick={(e) => e.stopPropagation()}>
        <StatusSelector
          value={status}
          onChange={(s) => setStatus(job.id, s)}
          label={job.title}
        />
      </div>

      {/* push the action to the bottom so cards in a row align */}
      <div className="mt-4 flex flex-1 items-end">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          // Apply must NOT open the modal.
          onClick={(e) => e.stopPropagation()}
          className={clsx(
            "relative inline-flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white",
            "transition-all duration-200 hover:border-transparent hover:text-white",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]"
          )}
          aria-label={`Apply to ${job.title}${
            job.company ? ` at ${job.company}` : ""
          } (opens in a new tab)`}
        >
          {/* gradient fill revealed on hover */}
          <span
            aria-hidden="true"
            className={clsx(
              "absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
              meta.gradient
            )}
          />
          <span className="relative">Apply</span>
          <ArrowUpRightIcon className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </div>
    </article>
  );
}
