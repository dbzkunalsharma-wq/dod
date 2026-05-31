"use client";

import clsx from "clsx";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { DISCIPLINE_MAP } from "@/lib/jobs";
import type { CompanyOutreach } from "@/lib/outreach";
import { emailTemplate, inmailTemplate } from "@/lib/outreach-templates";
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
  const [freshOnly, setFreshOnly] = useState(false);
  const { statusOf, setStatus, countOf } = useOutreach();

  // How many companies have a role posted in the last 7 days (real posting
  // dates) — drives the "Posted this week" toggle's live count.
  const freshCount = useMemo(
    () => companies.filter((c) => c.postedThisWeek).length,
    [companies]
  );

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

    if (statusFilter !== "all") {
      list = list.filter((c) => statusOf(c.slug) === statusFilter);
    }

    if (freshOnly) {
      list = list.filter((c) => c.postedThisWeek);
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
      // "Freshest" — posted-this-week first, then most fresh roles, then score.
      sorted.sort(
        (a, b) =>
          Number(b.postedThisWeek) - Number(a.postedThisWeek) ||
          b.freshRoleCount - a.freshRoleCount ||
          b.score - a.score ||
          a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      );
    } else {
      // "score" — the server order, re-applied defensively.
      sorted.sort(
        (a, b) =>
          b.score - a.score ||
          b.openRoles - a.openRoles ||
          a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      );
    }
    return sorted;
  }, [companies, query, sort, statusFilter, freshOnly, statusOf]);

  const statusCounts = OUTREACH_STATUS_ORDER.map((s) => ({
    status: s,
    count: countOf(s),
  }));

  return (
    <>
      {/* actions */}
      <div className="mt-6">
        <ActionsBar rows={companies} />
      </div>

      {/* search + sort island */}
      <div className="dod-glass dod-glass--silver mt-4 rounded-2xl p-3 sm:p-4">
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
          <div className="relative inline-flex shrink-0 items-center">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              aria-label="Sort companies"
              className={clsx(
                "appearance-none rounded-full border border-[var(--silver-line)] bg-white/[0.06] py-2.5 pl-4 pr-9 text-sm font-medium text-white",
                "backdrop-blur-md transition-colors duration-200 hover:border-white/25 hover:bg-white/[0.1]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                "[&>option]:bg-[#0f111a] [&>option]:text-white"
              )}
            >
              <option value="score">Hiring-intent score</option>
              <option value="fresh">Freshest</option>
              <option value="roles">Most roles</option>
              <option value="name">Name A–Z</option>
            </select>
            <ChevronDownIcon
              aria-hidden="true"
              className="pointer-events-none absolute right-3.5 h-3.5 w-3.5 text-white/45"
            />
          </div>
        </div>

        {/* status filter + counts */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <FilterPill
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          >
            All
            <span className="tabular-nums text-white/45">
              ({companies.length})
            </span>
          </FilterPill>
          {statusCounts.map(({ status, count }) => (
            <FilterPill
              key={status}
              active={statusFilter === status}
              dot={STATUS_VISUALS[status].dot}
              onClick={() => setStatusFilter(status)}
            >
              {OUTREACH_STATUS_LABELS[status]}
              <span className="tabular-nums text-white/45">({count})</span>
            </FilterPill>
          ))}

          {/* freshness toggle — orthogonal to status, so set apart by a divider */}
          <span
            aria-hidden="true"
            className="mx-0.5 h-4 w-px self-center bg-[var(--silver-line)]"
          />
          <FilterPill
            active={freshOnly}
            dot="bg-emerald-400"
            onClick={() => setFreshOnly((v) => !v)}
            title="Show only companies with a role posted in the last 7 days (fresh hiring activity), from real posting dates — not never-seen-before."
          >
            Posted this week
            <span className="tabular-nums text-white/45">· {freshCount}</span>
          </FilterPill>
        </div>
      </div>

      {/* result count */}
      <p
        className="mt-5 text-sm text-white/55"
        aria-live="polite"
        aria-atomic="true"
      >
        {filtered.length.toLocaleString("en-IN")}{" "}
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
                {filtered.map((c) => (
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
            {filtered.map((c) => (
              <li key={c.slug}>
                <OutreachCard
                  company={c}
                  status={statusOf(c.slug)}
                  onStatus={(s) => setStatus(c.slug, s)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
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

/** Green "● N this week" pill for companies with a role posted in the last 7d. */
function FreshBadge({ company }: { company: CompanyOutreach }) {
  if (!company.postedThisWeek) return null;
  const n = company.freshRoleCount;
  return (
    <span
      title={`${n} ${
        n === 1 ? "role" : "roles"
      } posted in the last 7 days (fresh hiring activity, from real posting dates)`}
      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/25"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {n} this week
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
              <FreshBadge company={company} />
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
              <FreshBadge company={company} />
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
