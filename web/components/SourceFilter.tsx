"use client";

import clsx from "clsx";
import { sourceLabel } from "@/lib/jobs";
import type { Source } from "@/lib/types";

export function SourceFilter({
  sources,
  counts,
  selected,
  onToggle,
  onClear,
}: {
  /** sources present in the (discipline+search) filtered data, in display order */
  sources: Source[];
  counts: Record<string, number>;
  selected: Set<Source>;
  onToggle: (source: Source) => void;
  onClear: () => void;
}) {
  if (sources.length === 0) return null;

  const allActive = selected.size === 0;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Filter by source"
    >
      <span className="mr-0.5 text-xs font-medium uppercase tracking-wide text-white/40">
        Source
      </span>

      <button
        type="button"
        onClick={onClear}
        aria-pressed={allActive}
        className={clsx(
          "rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
          allActive
            ? "border-[var(--silver-bright)] bg-white/15 text-white"
            : "border-[var(--silver-line)] bg-white/[0.04] text-white/55 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
        )}
      >
        All
      </button>

      {sources.map((src) => {
        const active = selected.has(src);
        return (
          <button
            key={src}
            type="button"
            onClick={() => onToggle(src)}
            aria-pressed={active}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              active
                ? "border-violet-300/40 bg-violet-400/20 text-white shadow-[0_4px_20px_-6px_rgba(139,92,246,0.5)]"
                : "border-[var(--silver-line)] bg-white/[0.04] text-white/55 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            )}
          >
            {sourceLabel(src)}
            <span
              className={clsx(
                "tabular-nums",
                active ? "text-white/70" : "text-white/35"
              )}
            >
              {counts[src] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
