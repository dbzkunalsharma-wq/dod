"use client";

import clsx from "clsx";
import {
  LOCATION_LABELS,
  WORK_MODES,
  LOCATIONS,
  sourceLabel,
} from "@/lib/jobs";
import type {
  DisciplineFilter,
  LocationFilter,
  SortMode,
  StatusFilter,
  WorkModeFilter,
} from "@/lib/useFilterState";
import type { Discipline, Source } from "@/lib/types";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";
import { STATUS_VISUALS } from "./tracker-ui";
import {
  BookmarkIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  CopyIcon,
  MapPinIcon,
  RupeeIcon,
  SortIcon,
  SparkleIcon,
  StarIcon,
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
  tone?: "neutral" | "amber" | "gold";
}) {
  const activeTone =
    tone === "amber"
      ? "border-amber-300/40 bg-amber-400/20 text-white shadow-[0_4px_20px_-6px_rgba(245,158,11,0.5)]"
      : tone === "gold"
        ? "border-[rgba(234,197,122,0.55)] bg-[rgba(226,184,110,0.18)] text-amber-50 shadow-[0_4px_20px_-6px_rgba(212,168,92,0.6)]"
        : "border-violet-300/40 bg-violet-400/20 text-white shadow-[0_4px_20px_-6px_rgba(139,92,246,0.5)]";
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
          ? activeTone
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
  hasSalaryOnly,
  topOnly,
  topCount,
  savedOnly,
  savedCount,
  onFresher,
  onHasSalary,
  onTop,
  onSaved,
}: {
  fresherOnly: boolean;
  hasSalaryOnly: boolean;
  topOnly: boolean;
  /** Live count of top-company roles reachable under the other filters. */
  topCount: number;
  savedOnly: boolean;
  savedCount: number;
  onFresher: () => void;
  onHasSalary: () => void;
  onTop: () => void;
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

      <Pill active={hasSalaryOnly} onClick={onHasSalary}>
        <RupeeIcon className="h-3.5 w-3.5" />
        Has salary
      </Pill>

      <Pill
        active={topOnly}
        onClick={onTop}
        tone="gold"
        ariaLabel="Show only roles at top companies"
      >
        <StarIcon className="h-3.5 w-3.5" />
        Top companies
        <span
          className={clsx(
            "tabular-nums",
            topOnly ? "text-amber-50/90" : "text-white/40"
          )}
        >
          {topCount}
        </span>
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
/*  Work-type chips — Remote / Hybrid / On-site / Internship           */
/*  A single-select row (with an "All" reset). Folds in the old        */
/*  internship toggle. Faceted counts shown per mode.                  */
/* ------------------------------------------------------------------ */

export function WorkTypeFilter({
  value,
  counts,
  onChange,
}: {
  value: WorkModeFilter;
  counts: Record<string, number>;
  onChange: (mode: WorkModeFilter) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Filter by work type"
    >
      <span className="mr-0.5 text-xs font-medium uppercase tracking-wide text-white/40">
        Work type
      </span>

      <button
        type="button"
        onClick={() => onChange("all")}
        aria-pressed={value === "all"}
        className={clsx(
          "rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
          value === "all"
            ? "border-[var(--silver-bright)] bg-white/15 text-white"
            : "border-[var(--silver-line)] bg-white/[0.04] text-white/55 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
        )}
      >
        All
      </button>

      {WORK_MODES.map((m) => {
        const active = value === m.key;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(active ? "all" : m.key)}
            aria-pressed={active}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              active
                ? "border-violet-300/40 bg-violet-400/20 text-white shadow-[0_4px_20px_-6px_rgba(139,92,246,0.5)]"
                : "border-[var(--silver-line)] bg-white/[0.04] text-white/55 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            )}
          >
            {m.label}
            <span
              className={clsx(
                "tabular-nums",
                active ? "text-white/70" : "text-white/35"
              )}
            >
              {counts[m.key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styled native <select> — accessible, keyboard-native, mobile-safe  */
/*  Used for the location facet + sort (long lists where a native      */
/*  popup beats a custom one for a11y).                                */
/* ------------------------------------------------------------------ */

function GlassSelect({
  value,
  onChange,
  ariaLabel,
  icon,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative inline-flex items-center">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 text-white/45"
      >
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={clsx(
          "appearance-none rounded-full border border-[var(--silver-line)] bg-white/[0.06] py-1.5 pl-9 pr-8 text-xs font-medium text-white",
          "backdrop-blur-md transition-colors duration-200 hover:border-white/25 hover:bg-white/[0.1]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
          // dark dropdown list (where the browser honours it)
          "[&>option]:bg-[#0f111a] [&>option]:text-white"
        )}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-white/45"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Location facet — dropdown of clean cities + Remote / Other         */
/* ------------------------------------------------------------------ */

export function LocationFilterSelect({
  value,
  counts,
  onChange,
}: {
  value: LocationFilter;
  counts: Record<string, number>;
  onChange: (loc: LocationFilter) => void;
}) {
  return (
    <GlassSelect
      value={value}
      onChange={(v) => onChange(v as LocationFilter)}
      ariaLabel="Filter by location"
      icon={<MapPinIcon className="h-3.5 w-3.5" />}
    >
      <option value="all">All locations</option>
      {LOCATIONS.map((l) => (
        <option key={l.key} value={l.key}>
          {l.label} ({counts[l.key] ?? 0})
        </option>
      ))}
    </GlassSelect>
  );
}

/* ------------------------------------------------------------------ */
/*  Sort control — Newest / Highest salary / Company A–Z               */
/* ------------------------------------------------------------------ */

const SORT_LABELS: Record<SortMode, string> = {
  newest: "Newest",
  salary: "Highest salary",
  company: "Company A–Z",
};

export function SortControl({
  value,
  onChange,
}: {
  value: SortMode;
  onChange: (s: SortMode) => void;
}) {
  return (
    <GlassSelect
      value={value}
      onChange={(v) => onChange(v as SortMode)}
      ariaLabel="Sort roles"
      icon={<SortIcon className="h-3.5 w-3.5" />}
    >
      {(Object.keys(SORT_LABELS) as SortMode[]).map((s) => (
        <option key={s} value={s}>
          {SORT_LABELS[s]}
        </option>
      ))}
    </GlassSelect>
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

/* ------------------------------------------------------------------ */
/*  Copy per-job link — copies the shareable `?job=<id>` URL           */
/*  (used inside the detail modal).                                    */
/* ------------------------------------------------------------------ */

export function CopyJobLinkButton({ jobId }: { jobId: string }) {
  const { copied, copy } = useCopyToClipboard();

  const onClick = () => {
    const base =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : "";
    copy(`${base}?job=${encodeURIComponent(jobId)}`);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Copy a shareable link to this role"
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]",
        copied
          ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
          : "border-white/10 bg-white/[0.06] text-white/75 hover:border-white/25 hover:bg-white/[0.12] hover:text-white"
      )}
    >
      {copied ? (
        <CheckIcon className="h-4 w-4" />
      ) : (
        <CopyIcon className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Active-filters summary — removable chips + one-tap "Clear all"     */
/* ------------------------------------------------------------------ */

const DISCIPLINE_LABELS: Record<Discipline, string> = {
  uiux: "UI/UX",
  product: "Product",
  communication: "Communication",
  industrial: "Industrial",
};

interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function ActiveFilters({
  discipline,
  search,
  sources,
  location,
  workMode,
  fresherOnly,
  hasSalaryOnly,
  topOnly,
  savedOnly,
  status,
  onClearDiscipline,
  onClearSearch,
  onRemoveSource,
  onClearLocation,
  onClearWorkMode,
  onClearFresher,
  onClearHasSalary,
  onClearTop,
  onClearSaved,
  onClearStatus,
  onClearAll,
}: {
  discipline: DisciplineFilter;
  search: string;
  sources: Set<Source>;
  location: LocationFilter;
  workMode: WorkModeFilter;
  fresherOnly: boolean;
  hasSalaryOnly: boolean;
  topOnly: boolean;
  savedOnly: boolean;
  status: StatusFilter;
  onClearDiscipline: () => void;
  onClearSearch: () => void;
  onRemoveSource: (s: Source) => void;
  onClearLocation: () => void;
  onClearWorkMode: () => void;
  onClearFresher: () => void;
  onClearHasSalary: () => void;
  onClearTop: () => void;
  onClearSaved: () => void;
  onClearStatus: () => void;
  onClearAll: () => void;
}) {
  const chips: ActiveChip[] = [];

  if (discipline !== "all")
    chips.push({
      key: "discipline",
      label: DISCIPLINE_LABELS[discipline],
      onRemove: onClearDiscipline,
    });
  if (search.trim())
    chips.push({
      key: "search",
      label: `“${search.trim()}”`,
      onRemove: onClearSearch,
    });
  if (location !== "all")
    chips.push({
      key: "location",
      label: LOCATION_LABELS[location],
      onRemove: onClearLocation,
    });
  if (workMode !== "all") {
    const m = WORK_MODES.find((w) => w.key === workMode);
    chips.push({
      key: "workmode",
      label: m?.label ?? workMode,
      onRemove: onClearWorkMode,
    });
  }
  if (fresherOnly)
    chips.push({
      key: "fresher",
      label: "Fresher-friendly",
      onRemove: onClearFresher,
    });
  if (hasSalaryOnly)
    chips.push({
      key: "salary",
      label: "Has salary",
      onRemove: onClearHasSalary,
    });
  if (topOnly)
    chips.push({
      key: "top",
      label: "Top companies",
      onRemove: onClearTop,
    });
  if (savedOnly)
    chips.push({ key: "saved", label: "Saved", onRemove: onClearSaved });
  if (status !== "all")
    chips.push({
      key: "status",
      label: status.charAt(0).toUpperCase() + status.slice(1),
      onRemove: onClearStatus,
    });
  for (const s of Array.from(sources).sort())
    chips.push({
      key: `src-${s}`,
      label: sourceLabel(s),
      onRemove: () => onRemoveSource(s),
    });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-xs font-medium uppercase tracking-wide text-white/40">
        Active
      </span>
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--silver-line)] bg-white/[0.06] py-1 pl-2.5 pr-1 text-xs font-medium text-white/75"
        >
          {c.label}
          <button
            type="button"
            onClick={c.onRemove}
            aria-label={`Remove ${c.label} filter`}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 rounded-full px-2.5 py-1 text-xs font-medium text-white/55 underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        Clear all
      </button>
    </div>
  );
}
