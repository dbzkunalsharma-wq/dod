"use client";

import Link from "next/link";
import { useRelativeTime } from "@/lib/useRelativeTime";

export function Header({
  total,
  generatedAt,
  loading,
}: {
  total: number;
  generatedAt: string | null;
  loading: boolean;
}) {
  // Live "Updated …" label. `null` during SSR / before hydration (avoids a
  // hydration mismatch), then refreshes every 30s on the client.
  const updated = useRelativeTime(generatedAt);

  return (
    <header className="dod-glass dod-glass--silver relative overflow-hidden rounded-3xl px-5 py-5 sm:px-7 sm:py-6">
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="flex items-center" aria-label="DOD">
              <svg viewBox="0 0 100 100" role="img" aria-hidden="true" className="h-10 w-10 sm:h-11 sm:w-11">
                <rect width="100" height="100" rx="22" fill="#ffffff" />
                <rect x="22" y="24" width="15" height="40" fill="none" stroke="#0a0a0b" strokeWidth="5" />
                <rect x="41.5" y="24" width="6" height="40" fill="#0a0a0b" />
                <circle cx="71" cy="34" r="12.5" fill="#0a0a0b" />
                <rect x="57" y="53" width="21" height="21" fill="none" stroke="#0a0a0b" strokeWidth="5" />
                <rect x="67" y="63" width="11" height="11" fill="#0a0a0b" />
              </svg>
              <span className="sr-only">DOD</span>
            </h1>
            <span className="hidden h-6 w-px bg-white/15 sm:block" />
            <p className="hidden text-sm text-white/60 sm:block">
              Live India design jobs
            </p>
          </div>
          <p className="mt-1 text-sm text-white/60 sm:hidden">
            Live India design jobs
          </p>
        </div>

        <div className="flex flex-col items-start gap-2.5 sm:items-end">
          <nav
            aria-label="Sections"
            className="flex items-center gap-1.5 text-sm"
          >
            <Link
              href="/companies"
              className="rounded-full border border-[var(--silver-line)] bg-white/[0.04] px-3 py-1.5 font-medium text-white/60 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Companies
            </Link>
            <Link
              href="/insights"
              className="rounded-full border border-[var(--silver-line)] bg-white/[0.04] px-3 py-1.5 font-medium text-white/60 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Insights
            </Link>
          </nav>
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--silver-line)] bg-white/[0.06] px-3 py-1.5 text-sm backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="dod-live-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold tabular-nums text-white">
                {loading ? "—" : total.toLocaleString("en-IN")}
              </span>
              <span className="text-white/55">open roles</span>
            </div>
            <p className="text-xs text-white/45">
              {loading
                ? "Loading…"
                : updated
                  ? `Updated ${updated}`
                  : "Live feed"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
