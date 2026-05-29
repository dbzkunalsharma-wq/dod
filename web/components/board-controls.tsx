"use client";

import clsx from "clsx";
import type { StatusFilter } from "@/lib/useFilterState";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";
import { STATUS_VISUALS } from "./tracker-ui";
import {
  BookmarkIcon,
  CheckIcon,
  CopyIcon,
  GridIcon,
  SparkleIcon,
} from "./icons";

/* ------------------------------------------------------------------ */
/*  A reusable pill toggle (shared look for the work-type / view chips) */
/* ------------------------------------------------------------------ */

function Pill({
  active,
  onClick,
  children,
  ariaLabel,
  tone = "neutral",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  tone?: "neutral" | "amber";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        active
          ? tone === "amber"
            ? "border-amber-300/40 bg-amber-400/20 text-white shadow-[0_4px_20px_-6px_rgba(245,158,11,0.5)]"
            : "border-violet-300/40 bg-violet-400/20 text-white shadow-[0_4px_20px_-6px_rgba(139,92,246,0.5)]"
          : "border-[var(--silver-line)] bg-white/[0.04] text-white/55 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Work-type / fresher chips + Saved view toggle                      */
/* ------------------------------------------------------------------ */

export function FilterChips({
  fresherOnly,
  internOnly,
  savedOnly,
  savedCount,
  onFresher,
  onIntern,
  onSaved,
}: {
  fresherOnly: boolean;
  internOnly: boolean;
  savedOnly: boolean;
  savedCount: number;
  onFresher: () => void;
  onIntern: () => void;
  onSaved: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Filter by work type and saved"
    >
      <span className="mr-0.5 text-xs font-medium uppercase tracking-wide text-white/40">
        Filters
      </span>

      <Pill active={fresherOnly} onClick={onFresher}>
        <SparkleIcon className="h-3.5 w-3.5" />
        Fresher-friendly
      </Pill>

      <Pill active={internOnly} onClick={onIntern}>
        <GridIcon className="h-3.5 w-3.5" />
        Internships
      </Pill>

      <Pill active={savedOnly} onClick={onSaved} tone="amber">
        <BookmarkIcon filled={savedOnly} className="h-3.5 w-3.5" />
        Saved
        <span
          className={clsx(
            "tabular-nums",
            savedOnly ? "text-white/80" : "text-white/40"
          )}
        >
          {savedCount}
        </span>
      </Pill>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status filter — All / Interested / Applied / Rejected              */
/* ------------------------------------------------------------------ */

const STATUS_FILTER_VALUES: StatusFilter[] = [
  "all",
  "interested",
  "applied",
  "rejected",
];

export function StatusFilterChips({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (s: StatusFilter) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Filter by status"
    >
      <span className="mr-0.5 text-xs font-medium uppercase tracking-wide text-white/40">
        Status
      </span>
      {STATUS_FILTER_VALUES.map((s) => {
        const active = value === s;
        const v = s === "all" ? null : STATUS_VISUALS[s];
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={active}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize backdrop-blur-md transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              active
                ? v
                  ? clsx(v.chip, "ring-1 ring-inset")
                  : "border-[var(--silver-bright)] bg-white/15 text-white"
                : "border-[var(--silver-line)] bg-white/[0.04] text-white/55 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            )}
          >
            {v && <span className={clsx("h-1.5 w-1.5 rounded-full", v.dot)} />}
            {s}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Copy link — copies the current shareable URL                       */
/* ------------------------------------------------------------------ */

export function CopyLinkButton({ queryString }: { queryString: string }) {
  const { copied, copy } = useCopyToClipboard();

  const onClick = () => {
    const base =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : "";
    copy(queryString ? `${base}?${queryString}` : base);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Copy a shareable link to this filtered view"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        copied
          ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
          : "border-[var(--silver-line)] bg-white/[0.04] text-white/65 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
      )}
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
      {copied ? "Link copied" : "Copy link"}
    </button>
  );
}
