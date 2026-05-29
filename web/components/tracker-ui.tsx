"use client";

import clsx from "clsx";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  type JobStatus,
} from "@/lib/useTracker";
import { BookmarkIcon, RupeeIcon } from "./icons";

/* ------------------------------------------------------------------ */
/*  Status palette — subtle colored chips on the dark glass surface    */
/* ------------------------------------------------------------------ */

type StatusVisual = { chip: string; dot: string; ring: string };

export const STATUS_VISUALS: Record<
  Exclude<JobStatus, "none">,
  StatusVisual
> = {
  interested: {
    chip: "bg-sky-500/15 text-sky-200 ring-sky-400/30",
    dot: "bg-sky-400",
    ring: "ring-sky-400/40",
  },
  applied: {
    chip: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/40",
  },
  rejected: {
    chip: "bg-rose-500/15 text-rose-200 ring-rose-400/30",
    dot: "bg-rose-400",
    ring: "ring-rose-400/40",
  },
};

/* ------------------------------------------------------------------ */
/*  Status chip — a small colored pill reflecting the saved status     */
/* ------------------------------------------------------------------ */

export function StatusChip({
  status,
  className,
}: {
  status: JobStatus;
  className?: string;
}) {
  if (status === "none") return null;
  const v = STATUS_VISUALS[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset backdrop-blur-sm",
        v.chip,
        className
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", v.dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Save (bookmark) toggle                                             */
/* ------------------------------------------------------------------ */

export function SaveButton({
  saved,
  onToggle,
  label,
  size = "sm",
  className,
}: {
  saved: boolean;
  onToggle: () => void;
  /** Accessible label suffix, e.g. the job title. */
  label?: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const dims = size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const icon = size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={saved}
      aria-label={`${saved ? "Remove from saved" : "Save"}${
        label ? ` — ${label}` : ""
      }`}
      title={saved ? "Saved" : "Save"}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full border transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]",
        dims,
        saved
          ? "border-amber-300/40 bg-amber-400/20 text-amber-200 shadow-[0_4px_18px_-6px_rgba(245,158,11,0.5)]"
          : "border-[var(--silver-line)] bg-white/[0.05] text-white/55 hover:border-white/30 hover:bg-white/[0.1] hover:text-white",
        className
      )}
    >
      <BookmarkIcon filled={saved} className={icon} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Status selector — interested / applied / rejected segmented pills  */
/* ------------------------------------------------------------------ */

export function StatusSelector({
  value,
  onChange,
  label,
  className,
}: {
  value: JobStatus;
  onChange: (status: JobStatus) => void;
  /** Accessible group label suffix, e.g. the job title. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={`Set status${label ? ` for ${label}` : ""}`}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border border-[var(--silver-line)] bg-white/[0.04] p-1",
        className
      )}
    >
      {STATUS_ORDER.map((s) => {
        const active = value === s;
        const v = STATUS_VISUALS[s];
        return (
          <button
            key={s}
            type="button"
            // Clicking the active one clears it back to "none".
            onClick={(e) => {
              e.stopPropagation();
              onChange(active ? "none" : s);
            }}
            aria-pressed={active}
            className={clsx(
              "rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              active
                ? clsx(v.chip, "ring-1 ring-inset")
                : "text-white/50 hover:bg-white/[0.08] hover:text-white"
            )}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NEW badge — flags roles seen within the last 48h                   */
/* ------------------------------------------------------------------ */

export function NewBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        "bg-gradient-to-r from-emerald-400/25 to-teal-400/25 text-emerald-100 ring-1 ring-inset ring-emerald-300/40",
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="dod-live-dot absolute inline-flex h-full w-full rounded-full bg-emerald-300" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      New
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Salary chip — shown only when a salary string is present           */
/* ------------------------------------------------------------------ */

export function SalaryChip({
  salary,
  className,
}: {
  salary: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        "bg-emerald-500/12 text-emerald-200 ring-1 ring-inset ring-emerald-400/25",
        className
      )}
    >
      <RupeeIcon className="h-3.5 w-3.5 text-emerald-300/90" />
      {salary}
    </span>
  );
}
