"use client";

import clsx from "clsx";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DISCIPLINE_MAP } from "@/lib/jobs";
import type { CompanySummary } from "@/lib/companies";
import { CompanyAvatar } from "./CompanyAvatar";
import { ChevronDownIcon, PinIcon, SearchIcon } from "./icons";
import { TopBadge } from "./tracker-ui";

type SortMode = "roles" | "name";

/**
 * Company directory — a responsive grid of company cards with a lightweight
 * client search + sort island. Hydrates over the SSG-rendered list; the data
 * itself is computed server-side and passed in, so the page is fully crawlable
 * even before JS. Filtering is a plain case-insensitive name substring; sorting
 * is deterministic (roles desc → name, or name A–Z), preserving the server's
 * top-company-first tie-break within equal role counts.
 */
export function CompanyDirectory({
  companies,
}: {
  companies: CompanySummary[];
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("roles");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? companies.filter((c) => c.name.toLowerCase().includes(q))
      : companies;
    if (sort === "name") {
      return [...list].sort((a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      );
    }
    // "roles" — preserve the server ordering (top first, then count desc, then
    // name), which is already what `companies` arrives in; re-sort defensively.
    return [...list].sort(
      (a, b) =>
        Number(b.isTop) - Number(a.isTop) ||
        b.count - a.count ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    );
  }, [companies, query, sort]);

  return (
    <>
      {/* search + sort island */}
      <div className="dod-glass dod-glass--silver mt-6 rounded-2xl p-3 sm:p-4">
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
              placeholder="Search companies…"
              aria-label="Search companies by name"
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
              <option value="roles">Most roles</option>
              <option value="name">Name A–Z</option>
            </select>
            <ChevronDownIcon
              aria-hidden="true"
              className="pointer-events-none absolute right-3.5 h-3.5 w-3.5 text-white/45"
            />
          </div>
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
        {query.trim() ? ` matching “${query.trim()}”` : " hiring"}
      </p>

      {/* grid */}
      {filtered.length === 0 ? (
        <div className="dod-glass dod-glass--silver mt-4 rounded-3xl px-6 py-16 text-center">
          <p className="text-sm text-white/55">
            No companies match your search.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <li key={c.slug}>
              <CompanyCard company={c} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CompanyCard({ company }: { company: CompanySummary }) {
  const { slug, name, count, disciplines, locations, logo, isTop } = company;
  const repDiscipline = disciplines[0] ?? "uiux";
  const locationHint = locations[0] ?? null;

  return (
    <Link
      href={`/companies/${slug}`}
      className={clsx(
        "dod-glass dod-glass--silver group relative flex h-full flex-col overflow-hidden rounded-2xl p-5 transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:bg-white/[0.09]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]",
        isTop && "dod-top"
      )}
      aria-label={`${name} — ${count} ${count === 1 ? "role" : "roles"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <CompanyAvatar
          company={name}
          logo={logo}
          discipline={repDiscipline}
          size="md"
        />
        {isTop && <TopBadge name={name} />}
      </div>

      <h2 className="mt-3 text-balance text-base font-semibold leading-snug tracking-tight text-white">
        {name}
      </h2>

      <p className="mt-1 text-sm tabular-nums text-white/60">
        {count.toLocaleString("en-IN")} {count === 1 ? "role" : "roles"}
      </p>

      {/* discipline dots */}
      {disciplines.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {disciplines.map((d) => {
            const meta = DISCIPLINE_MAP[d];
            return (
              <span
                key={d}
                title={meta.label}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                  meta.badge
                )}
              >
                <span className={clsx("h-1.5 w-1.5 rounded-full", meta.dot)} />
                {meta.label}
              </span>
            );
          })}
        </div>
      )}

      {locationHint && (
        <div className="mt-auto flex items-center gap-1 pt-3 text-xs text-white/50">
          <PinIcon className="h-3.5 w-3.5 text-white/35" />
          <span className="truncate">
            {locationHint}
            {locations.length > 1 ? ` +${locations.length - 1}` : ""}
          </span>
        </div>
      )}
    </Link>
  );
}
