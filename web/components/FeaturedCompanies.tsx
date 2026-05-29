"use client";

import clsx from "clsx";
import Link from "next/link";
import { useMemo } from "react";
import { buildCompanies } from "@/lib/companies";
import type { Job } from "@/lib/types";
import { CompanyAvatar } from "./CompanyAvatar";
import { StarIcon } from "./icons";

/**
 * "Featured companies hiring" — a horizontal, scrollable row of the top
 * companies currently present in the (filter-respecting) feed. Each chip is a
 * Link to that company's directory page (`/companies/[slug]`), showing its
 * logo + name + open-role count. Built via `buildCompanies` so the slug,
 * display name and logo match the company directory exactly; only `isTop`
 * companies are shown, sorted by role count (then name).
 *
 * Renders nothing when no top-company role is reachable.
 */
export function FeaturedCompanies({
  jobs,
}: {
  /** The jobs to draw featured companies from (already filter-narrowed). */
  jobs: Job[];
}) {
  const featured = useMemo(() => {
    return buildCompanies(jobs)
      .filter((c) => c.isTop)
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.name.localeCompare(b.name, "en", { sensitivity: "base" })
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
        {featured.map((c) => (
          <li key={c.slug} className="shrink-0">
            <Link
              href={`/companies/${c.slug}`}
              aria-label={`${c.name} — ${c.count} ${
                c.count === 1 ? "role" : "roles"
              }`}
              className={clsx(
                "group inline-flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all duration-200",
                "border-[rgba(234,197,122,0.32)] bg-[rgba(226,184,110,0.08)]",
                "hover:border-[rgba(234,197,122,0.6)] hover:bg-[rgba(226,184,110,0.16)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]"
              )}
            >
              <CompanyAvatar
                company={c.name}
                logo={c.logo}
                discipline={c.disciplines[0] ?? "uiux"}
                size="sm"
              />
              <span className="flex flex-col">
                <span className="whitespace-nowrap text-sm font-semibold text-white">
                  {c.name}
                </span>
                <span className="text-xs tabular-nums text-white/55">
                  {c.count} {c.count === 1 ? "role" : "roles"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
