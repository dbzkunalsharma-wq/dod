"use client";

import { useEffect, useRef } from "react";

/**
 * Infinite-scroll sentinel + explicit "Load more" button.
 *
 * An IntersectionObserver watches a 1px sentinel placed below the grid; when it
 * scrolls into view (with a generous rootMargin so the next page is fetched
 * before the user hits the very bottom) it calls `onMore`. The button is the
 * keyboard / no-JS / reduced-motion fallback and an explicit affordance — both
 * paths call the same handler.
 */
export function LoadMore({
  onMore,
  remaining,
  loadedLabel,
}: {
  /** Reveal the next page of cards. */
  onMore: () => void;
  /** How many cards are still hidden (0 → nothing left to show). */
  remaining: number;
  /** e.g. "Showing 48 of 312" — announced for screen readers. */
  loadedLabel: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Keep the latest handler without re-subscribing the observer each render.
  const onMoreRef = useRef(onMore);
  onMoreRef.current = onMore;

  useEffect(() => {
    if (remaining <= 0) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onMoreRef.current();
      },
      { rootMargin: "600px 0px" } // prefetch before reaching the bottom
    );
    io.observe(node);
    return () => io.disconnect();
  }, [remaining]);

  if (remaining <= 0) return null;

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onMore}
        className="rounded-xl border border-white/10 bg-white/[0.06] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:border-white/25 hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        Load more
        <span className="ml-1.5 tabular-nums text-white/50">
          {remaining.toLocaleString("en-IN")} left
        </span>
      </button>
      <p className="text-xs text-white/35" aria-live="polite">
        {loadedLabel}
      </p>
      {/* the actual intersection target — invisible, below the button */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
    </div>
  );
}
