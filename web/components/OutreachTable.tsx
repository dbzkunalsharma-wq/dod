"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DISCIPLINES, DISCIPLINE_MAP } from "@/lib/jobs";
import type { CompanyOutreach } from "@/lib/outreach";
import {
  emailTemplate,
  followUpTemplate,
  inmailTemplate,
} from "@/lib/outreach-templates";
import type { Discipline } from "@/lib/types";
import {
  OUTREACH_STATUS_LABELS,
  OUTREACH_STATUS_ORDER,
  useOutreach,
  type OutreachStatus,
} from "@/lib/useOutreach";
import { CompanyAvatar } from "./CompanyAvatar";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  MailIcon,
  PhoneIcon,
  SearchIcon,
} from "./icons";
import { TopBadge } from "./tracker-ui";

type SortMode = "score" | "fresh" | "roles" | "name";
type StatusFilter = "all" | Exclude<OutreachStatus, "none">;
/** Lifecycle facet from the ledger (orthogonal to the manual status tracker). */
type LifecycleFilter = "all" | "hiring" | "new" | "dormant";

/** How many rows to render before "Load more" (the ledger grows to thousands). */
const PAGE_SIZE = 150;

/* ------------------------------------------------------------------ */
/*  Status palette (subtle colored chips on the dark glass surface)    */
/* ------------------------------------------------------------------ */

const STATUS_VISUALS: Record<
  Exclude<OutreachStatus, "none">,
  { chip: string; dot: string }
> = {
  "to-contact": {
    chip: "bg-white/10 text-white/80 ring-white/25",
    dot: "bg-white/60",
  },
  contacted: {
    chip: "bg-sky-500/15 text-sky-200 ring-sky-400/30",
    dot: "bg-sky-400",
  },
  replied: {
    chip: "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    dot: "bg-amber-400",
  },
  scheduled: {
    chip: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    dot: "bg-emerald-400",
  },
};

/* ------------------------------------------------------------------ */
/*  Clipboard helper — copy with a transient "copied" pulse            */
/* ------------------------------------------------------------------ */

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** A small button that copies `value` and flashes a check for ~1.4s. */
function CopyButton({
  value,
  label,
  children,
  className,
}: {
  value: string;
  /** Accessible label, e.g. "Copy careers email". */
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const onClick = useCallback(async () => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? `Copied — ${label}` : label}
      title={label}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        copied
          ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
          : "border-[var(--silver-line)] bg-white/[0.05] text-white/70 hover:border-white/25 hover:bg-white/[0.1] hover:text-white",
        className
      )}
    >
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Status selector — segmented pills, persisted via useOutreach       */
/* ------------------------------------------------------------------ */

function StatusSelector({
  value,
  onChange,
  label,
}: {
  value: OutreachStatus;
  onChange: (s: OutreachStatus) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={`Outreach status for ${label}`}
      className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[var(--silver-line)] bg-white/[0.04] p-1"
    >
      {OUTREACH_STATUS_ORDER.map((s) => {
        const active = value === s;
        const v = STATUS_VISUALS[s];
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(active ? "none" : s)}
            aria-pressed={active}
            className={clsx(
              "rounded-full px-2 py-0.5 text-[11px] font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              active
                ? clsx(v.chip, "ring-1 ring-inset")
                : "text-white/45 hover:bg-white/[0.08] hover:text-white"
            )}
          >
            {OUTREACH_STATUS_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Score pill — number + reasons in the title tooltip                 */
/* ------------------------------------------------------------------ */

function ScorePill({ score, reasons }: { score: number; reasons: string[] }) {
  // Warm for hot, cool for cold — purely cosmetic banding.
  const tone =
    score >= 70
      ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
      : score >= 45
        ? "bg-amber-500/15 text-amber-200 ring-amber-400/30"
        : "bg-white/8 text-white/70 ring-white/20";
  return (
    <span
      title={reasons.join(" · ")}
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ring-1 ring-inset",
        tone
      )}
    >
      {score}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Top-of-page actions — Download CSV + Copy all domains              */
/* ------------------------------------------------------------------ */

function ActionsBar({ rows }: { rows: CompanyOutreach[] }) {
  // Only MX-verified domains are worth feeding to Hunter / Apollo — unresolved
  // guesses are dropped, matching what's surfaced in the table.
  const domains = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .filter((r) => r.domainVerified)
            .map((r) => r.domain)
            .filter((d): d is string => !!d)
        )
      ),
    [rows]
  );

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <a
        href="/outreach.csv"
        download="dod-outreach.csv"
        className={clsx(
          "inline-flex items-center gap-2 rounded-full border border-[var(--silver-bright)] bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors",
          "hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        )}
      >
        <ArrowUpRightIcon className="h-4 w-4 rotate-90" />
        Download CSV
      </a>
      <CopyButton
        value={domains.join("\n")}
        label={`Copy all ${domains.length} domains for Hunter / Apollo`}
        className="px-4 py-2 text-sm"
      >
        Copy all domains
        <span className="tabular-nums text-white/50">({domains.length})</span>
      </CopyButton>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Outreach table (client island)                                     */
/* ------------------------------------------------------------------ */

export function OutreachTable({ companies }: { companies: CompanyOutreach[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("score");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [lifecycle, setLifecycle] = useState<LifecycleFilter>("all");
  const [discipline, setDiscipline] = useState<Discipline | "all">("all");
  const [city, setCity] = useState<string>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const { statusOf, setStatus, countOf } = useOutreach();

  // Lifecycle counts (from the ledger fields) for the filter pills + header.
  const lifecycleCounts = useMemo(
    () => ({
      all: companies.length,
      hiring: companies.filter((c) => c.currentlyHiring).length,
      new: companies.filter((c) => c.isNewCompany).length,
      dormant: companies.filter((c) => c.dormant).length,
    }),
    [companies]
  );

  // Distinct concrete city labels present, for the city dropdown (skip the
  // "—" / "Multiple" buckets, which aren't useful filter targets).
  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of companies) {
      if (c.city && c.city !== "—" && c.city !== "Multiple") set.add(c.city);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "en"));
  }, [companies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = companies;

    if (q) {
      list = list.filter((c) => {
        const hay = `${c.name} ${c.city} ${c.disciplines
          .map((d) => DISCIPLINE_MAP[d].label)
          .join(" ")} ${c.locations.join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (lifecycle === "hiring") list = list.filter((c) => c.currentlyHiring);
    else if (lifecycle === "new") list = list.filter((c) => c.isNewCompany);
    else if (lifecycle === "dormant") list = list.filter((c) => c.dormant);

    if (discipline !== "all") {
      list = list.filter((c) => c.disciplines.includes(discipline));
    }

    if (city !== "all") {
      list = list.filter((c) => c.city === city);
    }

    if (statusFilter !== "all") {
      list = list.filter((c) => statusOf(c.slug) === statusFilter);
    }

    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      );
    } else if (sort === "roles") {
      sorted.sort(
        (a, b) =>
          b.openRoles - a.openRoles ||
          b.score - a.score ||
          a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      );
    } else if (sort === "fresh") {
      // "Freshest" — fresh-this-week first, then most open roles, then score.
      sorted.sort(
        (a, b) =>
          Number(b.freshThisWeek) - Number(a.freshThisWeek) ||
          b.freshRoleCount - a.freshRoleCount ||
          b.score - a.score ||
          a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      );
    } else {
      // "score" — the server order (hiring-first, then score), re-applied.
      sorted.sort(
        (a, b) =>
          Number(b.currentlyHiring) - Number(a.currentlyHiring) ||
          b.score - a.score ||
          a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      );
    }
    return sorted;
  }, [
    companies,
    query,
    sort,
    statusFilter,
    lifecycle,
    discipline,
    city,
    statusOf,
  ]);

  // Reset the visible window whenever the filter result set changes, so
  // "Load more" always starts from the top of the new list.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, sort, statusFilter, lifecycle, discipline, city]);

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > shown.length;

  const statusCounts = OUTREACH_STATUS_ORDER.map((s) => ({
    status: s,
    count: countOf(s),
  }));

  const lifecyclePills: Array<{ key: LifecycleFilter; label: string; dot?: string }> = [
    { key: "all", label: "All" },
    { key: "hiring", label: "Hiring now", dot: "bg-emerald-400" },
    { key: "new", label: "New this week", dot: "bg-sky-400" },
    { key: "dormant", label: "Dormant", dot: "bg-white/35" },
  ];

  return (
    <>
      {/* actions */}
      <div className="mt-6">
        <ActionsBar rows={companies} />
      </div>

      {/* header line — total · hiring now · grows daily */}
      <p className="mt-5 text-sm text-white/55">
        <span className="font-medium text-white/80">
          {companies.length.toLocaleString("en-IN")}
        </span>{" "}
        companies ·{" "}
        <span className="font-medium text-emerald-300/90">
          {lifecycleCounts.hiring.toLocaleString("en-IN")} hiring now
        </span>{" "}
        · grows daily
      </p>

      {/* search + sort island */}
      <div className="dod-glass dod-glass--silver mt-3 rounded-2xl p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"
            >
              <SearchIcon className="h-4 w-4" />
            </span>
            <input
              type="search"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company, city or discipline…"
              aria-label="Search by company, city or discipline"
              className={clsx(
                "w-full rounded-full border border-[var(--silver-line)] bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40",
                "backdrop-blur-md transition-colors duration-200 hover:border-white/20",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              )}
            />
          </div>
          <SelectPill
            value={discipline}
            onChange={(v) => setDiscipline(v as Discipline | "all")}
            ariaLabel="Filter by discipline"
          >
            <option value="all">All disciplines</option>
            {DISCIPLINES.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </SelectPill>
          {cityOptions.length > 0 && (
            <SelectPill
              value={city}
              onChange={setCity}
              ariaLabel="Filter by city"
            >
              <option value="all">All cities</option>
              {cityOptions.map((cityName) => (
                <option key={cityName} value={cityName}>
                  {cityName}
                </option>
              ))}
            </SelectPill>
          )}
          <SelectPill
            value={sort}
            onChange={(v) => setSort(v as SortMode)}
            ariaLabel="Sort companies"
          >
            <option value="score">Hiring-intent score</option>
            <option value="fresh">Freshest</option>
            <option value="roles">Most roles</option>
            <option value="name">Name A–Z</option>
          </SelectPill>
        </div>

        {/* lifecycle filter (from the ledger) */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {lifecyclePills.map(({ key, label, dot }) => (
            <FilterPill
              key={key}
              active={lifecycle === key}
              dot={dot}
              onClick={() => setLifecycle(key)}
            >
              {label}
              <span className="tabular-nums text-white/45">
                ({lifecycleCounts[key].toLocaleString("en-IN")})
              </span>
            </FilterPill>
          ))}

          {/* manual pipeline status — orthogonal, so set apart by a divider */}
          <span
            aria-hidden="true"
            className="mx-0.5 h-4 w-px self-center bg-[var(--silver-line)]"
          />
          {statusCounts.map(({ status, count }) => (
            <FilterPill
              key={status}
              active={statusFilter === status}
              dot={STATUS_VISUALS[status].dot}
              onClick={() =>
                setStatusFilter((cur) => (cur === status ? "all" : status))
              }
            >
              {OUTREACH_STATUS_LABELS[status]}
              <span className="tabular-nums text-white/45">({count})</span>
            </FilterPill>
          ))}
        </div>
      </div>

      {/* result count */}
      <p
        className="mt-5 text-sm text-white/55"
        aria-live="polite"
        aria-atomic="true"
      >
        {hasMore
          ? `Showing ${shown.length.toLocaleString(
              "en-IN"
            )} of ${filtered.length.toLocaleString("en-IN")} `
          : `${filtered.length.toLocaleString("en-IN")} `}
        {filtered.length === 1 ? "company" : "companies"}
        {query.trim() ? ` matching “${query.trim()}”` : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="dod-glass dod-glass--silver mt-4 rounded-3xl px-6 py-16 text-center">
          <p className="text-sm text-white/55">No companies match your filters.</p>
        </div>
      ) : (
        <>
          {/* desktop table */}
          <div className="dod-glass dod-glass--silver mt-4 hidden overflow-hidden rounded-2xl lg:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--silver-line)] text-xs uppercase tracking-wide text-white/45">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Company
                  </th>
                  <th scope="col" className="px-3 py-3 text-center font-medium">
                    Roles
                  </th>
                  <th scope="col" className="px-3 py-3 text-center font-medium">
                    Score
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    Contacts
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    Links
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Outreach
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <OutreachRow
                    key={c.slug}
                    company={c}
                    status={statusOf(c.slug)}
                    onStatus={(s) => setStatus(c.slug, s)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile / tablet cards */}
          <ul className="mt-4 flex flex-col gap-3 lg:hidden">
            {shown.map((c) => (
              <li key={c.slug}>
                <OutreachCard
                  company={c}
                  status={statusOf(c.slug)}
                  onStatus={(s) => setStatus(c.slug, s)}
                />
              </li>
            ))}
          </ul>

          {/* load more — keeps the growing list cheap to render */}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border border-[var(--silver-bright)] bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-colors",
                  "hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                )}
              >
                Load more
                <span className="tabular-nums text-white/55">
                  ({(filtered.length - shown.length).toLocaleString("en-IN")} more)
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Select pill — styled native <select> matching the glass aesthetic  */
/* ------------------------------------------------------------------ */

function SelectPill({
  value,
  onChange,
  ariaLabel,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative inline-flex shrink-0 items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={clsx(
          "appearance-none rounded-full border border-[var(--silver-line)] bg-white/[0.06] py-2.5 pl-4 pr-9 text-sm font-medium text-white",
          "backdrop-blur-md transition-colors duration-200 hover:border-white/25 hover:bg-white/[0.1]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
          "[&>option]:bg-[#0f111a] [&>option]:text-white"
        )}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 h-3.5 w-3.5 text-white/45"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter pill                                                        */
/* ------------------------------------------------------------------ */

function FilterPill({
  active,
  dot,
  onClick,
  title,
  children,
}: {
  active: boolean;
  dot?: string;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        active
          ? "border-[var(--silver-bright)] bg-white/15 text-white"
          : "border-[var(--silver-line)] bg-white/[0.04] text-white/60 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
      )}
    >
      {dot && <span className={clsx("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared cell sub-components                                         */
/* ------------------------------------------------------------------ */

/** Format an ISO "YYYY-MM-DD" as a short, locale-stable "5 May 2026". */
function formatLedgerDate(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Lifecycle status badge from the ledger:
 *   - green "Hiring now" when the company has open roles in the latest run,
 *   - a sky "New" chip when it first appeared within the last 7 days,
 *   - a muted "Dormant · last seen {date}" otherwise (no live roles).
 * Hiring + New can co-occur (a brand-new company that's hiring shows both).
 */
function StatusBadge({ company }: { company: CompanyOutreach }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {company.currentlyHiring && (
        <span
          title="Open roles in the latest run — actively hiring now"
          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/25"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Hiring now
        </span>
      )}
      {company.isNewCompany && (
        <span
          title={`New to the ledger — first seen ${formatLedgerDate(
            company.firstSeen
          )}`}
          className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-medium text-sky-200 ring-1 ring-inset ring-sky-400/25"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          New
        </span>
      )}
      {company.dormant && (
        <span
          title={`No live roles in the latest run — last seen ${formatLedgerDate(
            company.lastSeen
          )}`}
          className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/50 ring-1 ring-inset ring-white/15"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
          Dormant · {formatLedgerDate(company.lastSeen)}
        </span>
      )}
    </span>
  );
}

function DisciplineDots({ company }: { company: CompanyOutreach }) {
  if (company.disciplines.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {company.disciplines.map((d) => {
        const meta = DISCIPLINE_MAP[d];
        return (
          <span
            key={d}
            title={meta.label}
            aria-label={meta.label}
            className={clsx("h-2 w-2 rounded-full", meta.dot)}
          />
        );
      })}
    </span>
  );
}

function ContactCell({ company }: { company: CompanyOutreach }) {
  const { emails, postedEmails, postedPhones } = company;
  return (
    <div className="flex flex-col gap-1.5">
      {emails ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <CopyButton value={emails.careers} label={`Copy ${emails.careers}`}>
            <MailIcon className="h-3.5 w-3.5 text-white/45" />
            careers@
          </CopyButton>
          <CopyButton value={emails.hr} label={`Copy ${emails.hr}`}>
            hr@
          </CopyButton>
          <span
            title="Domain is MX-verified — it resolves and accepts mail"
            aria-label="MX-verified domain"
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-300/80"
          >
            <CheckIcon className="h-3 w-3" />
          </span>
        </div>
      ) : (
        <span
          title="No mailable domain (the guessed domain didn't resolve) — use the LinkedIn search or Hunter / Apollo instead"
          className="text-xs text-white/40"
        >
          — <span className="text-white/30">use LinkedIn / Hunter</span>
        </span>
      )}

      {postedEmails.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {postedEmails.slice(0, 2).map((e) => (
            <span
              key={e}
              title={`Recruiter email this company published: ${e}`}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/25"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {e}
            </span>
          ))}
        </div>
      )}

      {postedPhones.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {postedPhones.slice(0, 2).map((p) => (
            <span
              key={p}
              title={`Phone / WhatsApp this company published: ${p}`}
              className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-medium text-sky-200 ring-1 ring-inset ring-sky-400/25"
            >
              <PhoneIcon className="h-3 w-3" />
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkPill({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border border-[var(--silver-line)] bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-white/70 transition-colors",
        "hover:border-white/25 hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      )}
    >
      {children}
      <ArrowUpRightIcon className="h-3 w-3 text-white/40" />
    </a>
  );
}

function LinksCell({ company }: { company: CompanyOutreach }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {company.careersUrl && (
        <LinkPill href={company.careersUrl}>Careers</LinkPill>
      )}
      <LinkPill href={company.linkedinCompanySearch}>LI company</LinkPill>
      <LinkPill href={company.linkedinTaSearch}>LI recruiters</LinkPill>
    </div>
  );
}

function OutreachActions({ company }: { company: CompanyOutreach }) {
  const { subject, body } = emailTemplate(company);
  const emailPayload = `Subject: ${subject}\n\n${body}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <CopyButton value={emailPayload} label={`Copy outreach email for ${company.name}`}>
        Copy email
      </CopyButton>
      <CopyButton
        value={inmailTemplate(company)}
        label={`Copy LinkedIn InMail for ${company.name}`}
      >
        Copy InMail
      </CopyButton>
      <FollowUpMenu company={company} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Follow-up menu — copy Touch 2 / Touch 3 of the sequence            */
/* ------------------------------------------------------------------ */

/** Build the clipboard payload for one follow-up touch (subject + body). */
function followUpPayload(company: CompanyOutreach, step: 2 | 3): string {
  const { subject, body } = followUpTemplate(company, step);
  return `Subject: ${subject}\n\n${body}`;
}

/**
 * A small "Copy follow-up ▾" control that reveals the two follow-up touches
 * (step 2 = +4-day nudge, step 3 = +7-day final). Each item copies that touch's
 * subject + body to the clipboard and flashes a check. Closes on outside click,
 * Escape, or after a copy.
 */
function FollowUpMenu({ company }: { company: CompanyOutreach }) {
  const [open, setOpen] = useState(false);
  const [copiedStep, setCopiedStep] = useState<2 | 3 | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copyStep = useCallback(
    async (step: 2 | 3) => {
      const ok = await copyText(followUpPayload(company, step));
      if (ok) {
        setCopiedStep(step);
        window.setTimeout(() => setCopiedStep(null), 1400);
      }
      setOpen(false);
    },
    [company]
  );

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Copy a follow-up email for ${company.name}`}
        title="Copy a follow-up touch (step 2 nudge / step 3 final)"
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
          copiedStep
            ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
            : "border-[var(--silver-line)] bg-white/[0.05] text-white/70 hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
        )}
      >
        {copiedStep ? (
          <CheckIcon className="h-3.5 w-3.5" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
        Copy follow-up
        <ChevronDownIcon className="h-3 w-3 text-white/45" />
      </button>

      {open && (
        <div
          role="menu"
          className={clsx(
            "absolute right-0 top-full z-20 mt-1.5 min-w-[14rem] overflow-hidden rounded-xl border border-[var(--silver-line)] p-1",
            "bg-[#11131c]/95 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl"
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => copyStep(2)}
            className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:bg-white/[0.08]"
          >
            <span className="font-medium text-white">Touch 2 · nudge</span>
            <span className="text-[11px] text-white/45">
              Short reminder · send ~4 days after the first email
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => copyStep(3)}
            className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:bg-white/[0.08]"
          >
            <span className="font-medium text-white">Touch 3 · final</span>
            <span className="text-[11px] text-white/45">
              Brief final follow-up · send ~7 days after the first email
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop row                                                        */
/* ------------------------------------------------------------------ */

function OutreachRow({
  company,
  status,
  onStatus,
}: {
  company: CompanyOutreach;
  status: OutreachStatus;
  onStatus: (s: OutreachStatus) => void;
}) {
  const repDiscipline = company.disciplines[0] ?? "uiux";
  return (
    <tr className="border-b border-white/[0.06] align-top last:border-b-0 hover:bg-white/[0.03]">
      {/* company */}
      <td className="px-4 py-4">
        <div className="flex items-start gap-3">
          <CompanyAvatar
            company={company.name}
            logo={company.logo}
            discipline={repDiscipline}
            size="sm"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/companies/${company.slug}`}
                className="truncate font-semibold text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {company.name}
              </Link>
              {company.isTop && <TopBadge name={company.name} />}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/55">
              <DisciplineDots company={company} />
              <span>{company.city}</span>
              <StatusBadge company={company} />
            </div>
            {company.domainVerified && company.domain && (
              <p className="mt-0.5 truncate text-xs text-white/40">
                {company.domain}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* roles */}
      <td className="px-3 py-4 text-center">
        <span className="font-semibold tabular-nums text-white">
          {company.openRoles}
        </span>
      </td>

      {/* score */}
      <td className="px-3 py-4 text-center">
        <ScorePill score={company.score} reasons={company.scoreReasons} />
      </td>

      {/* contacts */}
      <td className="px-3 py-4">
        <ContactCell company={company} />
      </td>

      {/* links */}
      <td className="px-3 py-4">
        <LinksCell company={company} />
      </td>

      {/* outreach + status */}
      <td className="px-4 py-4">
        <div className="flex flex-col gap-2">
          <OutreachActions company={company} />
          <StatusSelector value={status} onChange={onStatus} label={company.name} />
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile card                                                        */
/* ------------------------------------------------------------------ */

function OutreachCard({
  company,
  status,
  onStatus,
}: {
  company: CompanyOutreach;
  status: OutreachStatus;
  onStatus: (s: OutreachStatus) => void;
}) {
  const repDiscipline = company.disciplines[0] ?? "uiux";
  return (
    <div className="dod-glass dod-glass--silver rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CompanyAvatar
            company={company.name}
            logo={company.logo}
            discipline={repDiscipline}
            size="sm"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/companies/${company.slug}`}
                className="font-semibold text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {company.name}
              </Link>
              {company.isTop && <TopBadge name={company.name} />}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/55">
              <DisciplineDots company={company} />
              <span>{company.city}</span>
              <span className="tabular-nums">
                · {company.openRoles}{" "}
                {company.openRoles === 1 ? "role" : "roles"}
              </span>
              <StatusBadge company={company} />
            </div>
          </div>
        </div>
        <ScorePill score={company.score} reasons={company.scoreReasons} />
      </div>

      <div className="mt-3 space-y-2.5 border-t border-white/[0.06] pt-3">
        <ContactCell company={company} />
        <LinksCell company={company} />
        <OutreachActions company={company} />
        <StatusSelector value={status} onChange={onStatus} label={company.name} />
      </div>
    </div>
  );
}
