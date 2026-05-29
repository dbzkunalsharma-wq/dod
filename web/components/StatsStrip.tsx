"use client";

import Link from "next/link";
import { useMemo } from "react";
import { effectiveTime, normalizeCompany } from "@/lib/jobs";
import type { Job } from "@/lib/types";
import { useNow } from "@/lib/useRelativeTime";
import { ArrowUpRightIcon } from "./icons";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A thin, subtle glass strip summarising the feed — "N roles · M companies ·
 * K new this week" — linking to the full /insights page. Additive: it sits
 * under the header without disrupting the hero discipline cards or filters.
 * Counts are derived client-side from the loaded feed (distinct companies use
 * the same normalised identity as the rest of the app). The time-dependent
 * "new this week" count uses `useNow()` (null during SSR) so the value only
 * appears post-hydration — avoiding a server/client mismatch on a clock value.
 */
export function StatsStrip({ jobs }: { jobs: Job[] }) {
  const now = useNow();

  // Time-independent counts — safe to compute during render / SSR.
  const { total, companies } = useMemo(() => {
    const companyKeys = new Set<string>();
    for (const job of jobs) {
      const original = job.company?.trim();
      if (!original) continue;
      const key = normalizeCompany(original) || original.toLowerCase();
      if (key) companyKeys.add(key);
    }
    return { total: jobs.length, companies: companyKeys.size };
  }, [jobs]);

  // "New this week" depends on the live clock → null until hydrated.
  const newThisWeek = useMemo(() => {
    if (now === null) return null;
    let fresh = 0;
    for (const job of jobs) {
      const t = effectiveTime(job);
      if (t > 0 && now - t >= 0 && now - t <= WEEK_MS) fresh += 1;
    }
    return fresh;
  }, [jobs, now]);

  if (total === 0) return null;

  return (
    <Link
      href="/insights"
      className="dod-glass dod-glass--silver group mt-4 flex items-center justify-between gap-3 rounded-full px-4 py-2.5 transition-colors duration-200 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      aria-label="View hiring insights"
    >
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-white/60 sm:text-sm">
        <span className="font-semibold tabular-nums text-white">
          {total.toLocaleString("en-IN")}
        </span>{" "}
        roles
        <span className="text-white/25" aria-hidden="true">
          ·
        </span>
        <span className="font-semibold tabular-nums text-white">
          {companies.toLocaleString("en-IN")}
        </span>{" "}
        companies
        <span className="text-white/25" aria-hidden="true">
          ·
        </span>
        <span className="font-semibold tabular-nums text-white">
          {newThisWeek === null ? "—" : newThisWeek.toLocaleString("en-IN")}
        </span>{" "}
        new this week
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-white/55 transition-colors group-hover:text-white">
        Insights
        <ArrowUpRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  );
}
