"use client";

import clsx from "clsx";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  effectiveTime,
  isFresherFriendly,
  isInternship,
  SOURCE_ORDER,
} from "@/lib/jobs";
import type { Discipline, Job, JobsFeed, Source } from "@/lib/types";
import { useFilterState } from "@/lib/useFilterState";
import { useTracker } from "@/lib/useTracker";
import { CopyLinkButton, FilterChips, StatusFilterChips } from "./board-controls";
import { EmptyState } from "./EmptyState";
import { Header } from "./Header";
import { JobCard } from "./JobCard";
import { JobDetailModal } from "./JobDetailModal";
import { SearchInput } from "./SearchInput";
import { SegmentedControl } from "./SegmentedControl";
import { SkeletonGrid } from "./SkeletonCard";
import { SourceFilter } from "./SourceFilter";

const DISCIPLINE_KEYS: Discipline[] = [
  "uiux",
  "product",
  "communication",
  "industrial",
];

type LoadState = "loading" | "ready" | "error";

function matchesSearch(job: Job, q: string): boolean {
  if (!q) return true;
  const haystack = [job.title, job.company, job.location]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function emptyDisciplineCounts(): Record<Discipline, number> {
  return { uiux: 0, product: 0, communication: 0, industrial: 0 };
}

/** The board proper — wrapped in <Suspense> below for useSearchParams(). */
function JobsBoardInner() {
  const [feed, setFeed] = useState<JobsFeed | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  // URL-synced filter state (the single source of truth, restored on load).
  const f = useFilterState();
  const {
    discipline,
    search,
    sources,
    fresherOnly,
    internOnly,
    savedOnly,
    status,
  } = f;

  // Save + status tracking (localStorage).
  const tracker = useTracker();

  // detail modal
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  /* -------------------------------- fetch -------------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/jobs.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as JobsFeed;
        if (!cancelled) {
          setFeed(data);
          setState("ready");
        }
      } catch (err) {
        console.error("Failed to load jobs feed:", err);
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allJobs = useMemo<Job[]>(() => {
    if (!feed?.jobs) return [];
    // sort newest-first by effective time (posted_at ?? seen_at)
    return [...feed.jobs].sort((a, b) => effectiveTime(b) - effectiveTime(a));
  }, [feed]);

  /* ---- predicate for the facet-independent filters (work-type / saved) --- */
  // These apply to every faceted count *and* the final list, so the discipline
  // and source tallies reflect what's actually reachable in the current view.
  const passesCommon = useMemo(() => {
    const savedMap = tracker.map;
    return (job: Job): boolean => {
      if (fresherOnly && !isFresherFriendly(job)) return false;
      if (internOnly && !isInternship(job)) return false;
      if (savedOnly && savedMap[job.id]?.saved !== true) return false;
      if (status !== "all" && (savedMap[job.id]?.status ?? "none") !== status)
        return false;
      return true;
    };
  }, [fresherOnly, internOnly, savedOnly, status, tracker.map]);

  /* --------- faceted counts (each facet ignores its own selection) ------- */

  // discipline counts: respect search + source + common, ignore discipline
  const disciplineCounts = useMemo(() => {
    const counts = emptyDisciplineCounts();
    for (const job of allJobs) {
      if (!matchesSearch(job, search)) continue;
      if (sources.size > 0 && !sources.has(job.source)) continue;
      if (!passesCommon(job)) continue;
      counts[job.discipline] += 1;
    }
    return counts;
  }, [allJobs, search, sources, passesCommon]);

  const disciplineTotal = useMemo(
    () =>
      DISCIPLINE_KEYS.reduce((sum, k) => sum + (disciplineCounts[k] ?? 0), 0),
    [disciplineCounts]
  );

  // source counts: respect discipline + search + common, ignore source
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of allJobs) {
      if (discipline !== "all" && job.discipline !== discipline) continue;
      if (!matchesSearch(job, search)) continue;
      if (!passesCommon(job)) continue;
      counts[job.source] = (counts[job.source] ?? 0) + 1;
    }
    return counts;
  }, [allJobs, discipline, search, passesCommon]);

  // which source chips to show (present anywhere in the feed), in fixed order
  const availableSources = useMemo(() => {
    const present = Array.from(new Set(allJobs.map((j) => j.source)));
    const ordered = SOURCE_ORDER.filter((s) => present.includes(s));
    const extra = present.filter((s) => !SOURCE_ORDER.includes(s));
    return [...ordered, ...extra];
  }, [allJobs]);

  /* ------------------------------ final list ----------------------------- */
  const visible = useMemo(() => {
    return allJobs.filter((job) => {
      if (discipline !== "all" && job.discipline !== discipline) return false;
      if (!matchesSearch(job, search)) return false;
      if (sources.size > 0 && !sources.has(job.source)) return false;
      if (!passesCommon(job)) return false;
      return true;
    });
  }, [allJobs, discipline, search, sources, passesCommon]);

  /* ------------------------------ handlers ------------------------------- */
  const toggleSource = (src: Source) => f.toggleSource(src);
  const clearSources = () => f.clearSources();
  const resetAll = () => f.reset();

  /* ----------------------------- result label ---------------------------- */
  const disciplineLabel =
    discipline === "all"
      ? ""
      : ({
          uiux: "UI/UX",
          product: "Product",
          communication: "Communication",
          industrial: "Industrial",
        }[discipline] ?? "");

  const resultLabel = useMemo(() => {
    const n = visible.length.toLocaleString("en-IN");
    const noun = visible.length === 1 ? "role" : "roles";
    const scope = savedOnly ? "saved " : "";
    return discipline === "all"
      ? `Showing ${n} ${scope}${noun}`
      : `Showing ${n} ${scope}${disciplineLabel} ${noun}`;
  }, [visible.length, discipline, disciplineLabel, savedOnly]);

  const loading = state === "loading";

  // Whether to surface the status filter row: in the saved view, or when a
  // status is already selected (so it stays togglable from any view).
  const showStatusFilter = savedOnly || status !== "all";

  /* -------------------------------- render ------------------------------- */
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <Header
        total={feed?.count ?? allJobs.length}
        generatedAt={feed?.generated_at ?? null}
        loading={loading}
      />

      {/* centerpiece: gradient discipline filter cards */}
      <div className="mt-8">
        <SegmentedControl
          value={discipline}
          counts={disciplineCounts}
          total={disciplineTotal}
          onChange={f.setDiscipline}
        />
      </div>

      {/* sticky glass filter bar: search + work-type chips + source chips */}
      <div className="sticky top-3 z-20 mt-5">
        <div className="dod-glass dod-glass--silver rounded-2xl p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <SearchInput value={search} onChange={f.setSearch} />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--silver-line)] pt-3">
              <FilterChips
                fresherOnly={fresherOnly}
                internOnly={internOnly}
                savedOnly={savedOnly}
                savedCount={tracker.savedCount}
                onFresher={() => f.setFresherOnly(!fresherOnly)}
                onIntern={() => f.setInternOnly(!internOnly)}
                onSaved={() => f.setSavedOnly(!savedOnly)}
              />
              <CopyLinkButton queryString={f.queryString} />
            </div>

            {showStatusFilter && (
              <div className="border-t border-[var(--silver-line)] pt-3">
                <StatusFilterChips value={status} onChange={f.setStatus} />
              </div>
            )}

            {availableSources.length > 0 && (
              <div className="border-t border-[var(--silver-line)] pt-3">
                <SourceFilter
                  sources={availableSources}
                  counts={sourceCounts}
                  selected={sources}
                  onToggle={toggleSource}
                  onClear={clearSources}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* result count row */}
      <div className="mt-6 flex h-6 items-center justify-between">
        <p
          className="text-sm text-white/55"
          aria-live="polite"
          aria-atomic="true"
        >
          {loading ? "Loading roles…" : state === "error" ? "" : resultLabel}
        </p>
        {f.hasActiveFilters && !loading && state !== "error" && (
          <button
            type="button"
            onClick={resetAll}
            className={clsx(
              "text-xs font-medium text-white/50 transition-colors hover:text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:rounded"
            )}
          >
            Reset filters
          </button>
        )}
      </div>

      {/* body */}
      <div className="mt-4">
        {loading ? (
          <SkeletonGrid count={6} />
        ) : state === "error" ? (
          <div className="dod-glass flex flex-col items-center justify-center rounded-3xl border-red-400/20 px-6 py-20 text-center">
            <h3 className="text-base font-semibold text-white">
              Couldn’t load the job feed
            </h3>
            <p className="mt-1 max-w-sm text-sm text-white/50">
              The data file didn’t respond. Refresh the page to try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]"
            >
              Reload
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="grid grid-cols-1">
            <EmptyState
              onReset={f.hasActiveFilters ? resetAll : undefined}
              savedView={savedOnly}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((job, i) => (
              <JobCard
                key={job.id}
                job={job}
                index={i}
                onOpen={setSelectedJob}
              />
            ))}
          </div>
        )}
      </div>

      {/* detail modal — portal-free overlay, rendered above all content */}
      <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}

export function JobsBoard() {
  return (
    <Suspense fallback={<BoardFallback />}>
      <JobsBoardInner />
    </Suspense>
  );
}

/** Lightweight shell shown until useSearchParams() resolves on the client. */
function BoardFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <div className="dod-glass dod-glass--silver dod-shimmer h-[120px] rounded-3xl" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="dod-glass dod-shimmer h-28 rounded-2xl"
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="mt-8">
        <SkeletonGrid count={6} />
      </div>
    </div>
  );
}
