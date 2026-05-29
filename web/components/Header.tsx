"use client";

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
            <h1 className="bg-gradient-to-br from-white via-violet-200 to-indigo-300 bg-clip-text font-mono text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              DOD
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
    </header>
  );
}
