"use client";

import { useRelativeTime } from "@/lib/useRelativeTime";

/**
 * Site footer — live role count, "updated N ago" from the feed's
 * `generated_at`, a source-attribution line, and a not-affiliated note.
 *
 * Rendered as the last flex child of <main> (which is `min-h-dvh flex-col`),
 * so `mt-auto` keeps it pinned to the bottom on short pages.
 */
export function SiteFooter({
  total,
  generatedAt,
  loading,
}: {
  total: number;
  generatedAt: string | null;
  loading: boolean;
}) {
  const updated = useRelativeTime(generatedAt);

  return (
    <footer className="mt-auto border-t border-white/10 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/55">
            <span className="bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text font-mono font-semibold text-transparent">
              DOD
            </span>
            <span className="text-white/25" aria-hidden="true">
              ·
            </span>
            <span>Live India design jobs</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
            <span className="font-medium tabular-nums text-white/70">
              {loading ? "—" : total.toLocaleString("en-IN")}
            </span>
            <span>roles tracked</span>
            {updated && (
              <>
                <span className="text-white/25" aria-hidden="true">
                  ·
                </span>
                <span>updated {updated}</span>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-white/35">
          <p>
            Aggregated from LinkedIn, Foundit, Unstop, Internshala, Apna, Shine,
            Behance, Dribbble, Greenhouse, Lever, Ashby, RemoteOK &amp;
            Telegram.
          </p>
          <p className="mt-1.5">
            DOD is an independent jobs aggregator and is not affiliated with,
            endorsed by, or sponsored by any of the listed companies or
            sources. All trademarks belong to their respective owners; links
            lead to the original postings.
          </p>
        </div>
      </div>
    </footer>
  );
}
