"use client";

import clsx from "clsx";
import { useMemo } from "react";
import { topCompanyName } from "@/lib/jobs";
import type { Job } from "@/lib/types";
import { CompanyAvatar } from "./CompanyAvatar";
import { StarIcon } from "./icons";

/**
 * "Featured companies hiring" — a horizontal, scrollable row of the top
 * companies currently present in the (filter-respecting) feed. Each chip
 * dedupes to a canonical company, shows its logo + name + open-role count,
 * sorted by count desc, and on click filters the board to that company by
 * seeding the search box with the canonical name.
 *
 * Renders nothing when no top-company role is reachable.
 */
export function FeaturedCompanies({
  jobs,
  onPick,
}: {
  /** The jobs to draw featured companies from (already filter-narrowed). */
  jobs: Job[];
  /** Filter the board to a company name (sets the search box value). */
  onPick: (companyName: string) => void;
}) {
  // Dedupe by canonical top-company name; keep a representative job for the
  // avatar (logo/favicon/initials) and the open-role count. Deterministic:
  // sort by count desc, then name A–Z for stable ties.
  const featured = useMemo(() => {
    const map = new Map<string, { name: string; count: number; sample: Job }>();
    for (const job of jobs) {
      const name = topCompanyName(job.company);
      if (!name) continue;
      const cur = map.get(name);
      if (cur) cur.count += 1;
      else map.set(name, { name, count: 1, sample: job });
    }
    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, "en")
    );
  }, [jobs]);

  if (featured.length === 0) return null;

  return (
    <section
      aria-label="Featured companies hiring"
      className="dod-glass dod-glass--silver mt-5 rounded-2xl p-3 sm:p-4"
    >
      <div className="mb-2.5 flex items-center gap-1.5">
        <StarIcon className="h-3.5 w-3.5 text-amber-200/80" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide text-white/45">
          Featured companies hiring
        </span>
      </div>

      {/* Horizontal scroller — keyboard-focusable chips, native overflow-x. */}
      <ul
        className={clsx(
          "flex gap-2 overflow-x-auto pb-1",
          // thin, on-aesthetic scrollbar + edge breathing room
          "[scrollbar-width:thin] [-ms-overflow-style:none]"
        )}
      >
        {featured.map(({ name, count, sample }) => (
          <li key={name} className="shrink-0">
            <button
              type="button"
              onClick={() => onPick(name)}
              aria-label={`Filter to ${name} — ${count} ${
                count === 1 ? "role" : "roles"
              }`}
              className={clsx(
                "group inline-flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all duration-200",
                "border-[rgba(234,197,122,0.32)] bg-[rgba(226,184,110,0.08)]",
                "hover:border-[rgba(234,197,122,0.6)] hover:bg-[rgba(226,184,110,0.16)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]"
              )}
            >
              <CompanyAvatar
                company={sample.company}
                logo={sample.logo}
                discipline={sample.discipline}
                size="sm"
              />
              <span className="flex flex-col">
                <span className="whitespace-nowrap text-sm font-semibold text-white">
                  {name}
                </span>
                <span className="text-xs tabular-nums text-white/55">
                  {count} {count === 1 ? "role" : "roles"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
