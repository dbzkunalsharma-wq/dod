"use client";

import clsx from "clsx";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  compareTopPicks,
  effectiveTime,
  hasSalary as jobHasSalary,
  isFresherFriendly,
  isTopCompany,
  locationKey,
  salaryValue,
  SOURCE_ORDER,
  workMode as jobWorkMode,
} from "@/lib/jobs";
import type { Discipline, Job, JobsFeed, Source } from "@/lib/types";
import { useFilterState } from "@/lib/useFilterState";
import { useTracker } from "@/lib/useTracker";
import {
  ActiveFilters,
  CopyLinkButton,
  FilterChips,
  LocationFilterSelect,
  SortControl,
  StatusFilterChips,
  WorkTypeFilter,
} from "./board-controls";
import { EmptyState } from "./EmptyState";
import { FeaturedCompanies } from "./FeaturedCompanies";
import { Header } from "./Header";
import { JobCard } from "./JobCard";
import { JobDetailModal } from "./JobDetailModal";
import { LoadMore } from "./LoadMore";
import { SearchInput } from "./SearchInput";
import { SegmentedControl } from "./SegmentedControl";
import { SiteFooter } from "./SiteFooter";
import { SkeletonGrid } from "./SkeletonCard";
import { SourceFilter } from "./SourceFilter";

const DISCIPLINE_KEYS: Discipline[] = [
  "uiux",
  "product",
  "communication",
  "industrial",
];

/** How many cards to reveal per page (initial render + each "load more"). */
const PAGE_SIZE = 24;

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

/** Compare for the active sort mode. */
function compareBySort(a: Job, b: Job, sort: string): number {
  if (sort === "top") {
    // "Top picks" — deterministic composite (recent-top-company → reputation
    // → pay → recency). See compareTopPicks in lib/jobs.
    return compareTopPicks(a, b);
  }
  if (sort === "salary") {
    // Highest salary first; unparseable (0) sinks. Tie-break by recency.
    const sa = salaryValue(a.salary);
    const sb = salaryValue(b.salary);
    if (sa !== sb) return sb - sa;
    return effectiveTime(b) - effectiveTime(a);
  }
  if (sort === "company") {
    // A–Z; nameless companies sink to the bottom. Tie-break by recency.
    const ca = a.company?.trim() ?? "";
    const cb = b.company?.trim() ?? "";
    if (!ca && !cb) return effectiveTime(b) - effectiveTime(a);
    if (!ca) return 1;
    if (!cb) return -1;
    const cmp = ca.localeCompare(cb, "en", { sensitivity: "base" });
    return cmp !== 0 ? cmp : effectiveTime(b) - effectiveTime(a);
  }
  // newest (default)
  return effectiveTime(b) - effectiveTime(a);
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
    location,
    workMode,
    fresherOnly,
    hasSalaryOnly,
    topOnly,
    savedOnly,
    status,
    sort,
  } = f;

  // Save + status tracking (localStorage).
  const tracker = useTracker();

  // detail modal — derived from the `?job=` URL param so it's deep-linkable.
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

  // Base list — newest-first; the chosen sort is applied to the filtered view.
  const allJobs = useMemo<Job[]>(() => {
    if (!feed?.jobs) return [];
    return [...feed.jobs].sort((a, b) => effectiveTime(b) - effectiveTime(a));
  }, [feed]);

  // Fast id → job lookup (for resolving the `?job=` deep-link).
  const byId = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of allJobs) m.set(j.id, j);
    return m;
  }, [allJobs]);

  /* ---- predicate for the facet-independent filters ---------------------- */
  // These apply to every faceted count *and* the final list, so the discipline
  // and source tallies reflect what's actually reachable in the current view.
  //
  // `passesCommonNoTop` is everything *except* the top-companies toggle — it
  // backs the featured strip and the toggle's own live count (which, like the
  // other facets, ignores its own selection). `passesCommon` adds the toggle
  // and is what every other faceted count + the final list use.
  const passesCommonNoTop = useMemo(() => {
    const savedMap = tracker.map;
    return (job: Job): boolean => {
      if (fresherOnly && !isFresherFriendly(job)) return false;
      if (hasSalaryOnly && !jobHasSalary(job)) return false;
      if (savedOnly && savedMap[job.id]?.saved !== true) return false;
      if (status !== "all" && (savedMap[job.id]?.status ?? "none") !== status)
        return false;
      return true;
    };
  }, [fresherOnly, hasSalaryOnly, savedOnly, status, tracker.map]);

  const passesCommon = useMemo(() => {
    return (job: Job): boolean => {
      if (!passesCommonNoTop(job)) return false;
      if (topOnly && !isTopCompany(job.company)) return false;
      return true;
    };
  }, [passesCommonNoTop, topOnly]);

  /* --------- faceted counts (each facet ignores its own selection) ------- */

  // discipline counts: respect every *other* facet, ignore discipline
  const disciplineCounts = useMemo(() => {
    const counts = emptyDisciplineCounts();
    for (const job of allJobs) {
      if (!matchesSearch(job, search)) continue;
      if (sources.size > 0 && !sources.has(job.source)) continue;
      if (location !== "all" && locationKey(job) !== location) continue;
      if (workMode !== "all" && jobWorkMode(job) !== workMode) continue;
      if (!passesCommon(job)) continue;
      counts[job.discipline] += 1;
    }
    return counts;
  }, [allJobs, search, sources, location, workMode, passesCommon]);

  const disciplineTotal = useMemo(
    () =>
      DISCIPLINE_KEYS.reduce((sum, k) => sum + (disciplineCounts[k] ?? 0), 0),
    [disciplineCounts]
  );

  // source counts: respect every *other* facet, ignore source
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of allJobs) {
      if (discipline !== "all" && job.discipline !== discipline) continue;
      if (!matchesSearch(job, search)) continue;
      if (location !== "all" && locationKey(job) !== location) continue;
      if (workMode !== "all" && jobWorkMode(job) !== workMode) continue;
      if (!passesCommon(job)) continue;
      counts[job.source] = (counts[job.source] ?? 0) + 1;
    }
    return counts;
  }, [allJobs, discipline, search, location, workMode, passesCommon]);

  // location counts: respect every *other* facet, ignore location
  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of allJobs) {
      if (discipline !== "all" && job.discipline !== discipline) continue;
      if (!matchesSearch(job, search)) continue;
      if (sources.size > 0 && !sources.has(job.source)) continue;
      if (workMode !== "all" && jobWorkMode(job) !== workMode) continue;
      if (!passesCommon(job)) continue;
      counts[locationKey(job)] = (counts[locationKey(job)] ?? 0) + 1;
    }
    return counts;
  }, [allJobs, discipline, search, sources, workMode, passesCommon]);

  // work-mode counts: respect every *other* facet, ignore work mode
  const workModeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of allJobs) {
      if (discipline !== "all" && job.discipline !== discipline) continue;
      if (!matchesSearch(job, search)) continue;
      if (sources.size > 0 && !sources.has(job.source)) continue;
      if (location !== "all" && locationKey(job) !== location) continue;
      if (!passesCommon(job)) continue;
      counts[jobWorkMode(job)] = (counts[jobWorkMode(job)] ?? 0) + 1;
    }
    return counts;
  }, [allJobs, discipline, search, sources, location, passesCommon]);

  // which source chips to show (present anywhere in the feed), in fixed order
  const availableSources = useMemo(() => {
    const present = Array.from(new Set(allJobs.map((j) => j.source)));
    const ordered = SOURCE_ORDER.filter((s) => present.includes(s));
    const extra = present.filter((s) => !SOURCE_ORDER.includes(s));
    return [...ordered, ...extra];
  }, [allJobs]);

  /* ---- top companies: featured strip + the toggle's live count ---------- */
  // Top-company roles reachable under every *other* filter (the facets + the
  // common toggles, but NOT the top-companies toggle itself). This drives both
  // the live count on the toggle and the "Featured companies hiring" strip, so
  // the strip stays populated whether or not the toggle is engaged.
  const topJobs = useMemo(() => {
    return allJobs.filter((job) => {
      if (!isTopCompany(job.company)) return false;
      if (discipline !== "all" && job.discipline !== discipline) return false;
      if (!matchesSearch(job, search)) return false;
      if (sources.size > 0 && !sources.has(job.source)) return false;
      if (location !== "all" && locationKey(job) !== location) return false;
      if (workMode !== "all" && jobWorkMode(job) !== workMode) return false;
      if (!passesCommonNoTop(job)) return false;
      return true;
    });
  }, [allJobs, discipline, search, sources, location, workMode, passesCommonNoTop]);
  const topCount = topJobs.length;

  /* ------------------------------ final list ----------------------------- */
  const visible = useMemo(() => {
    const filtered = allJobs.filter((job) => {
      if (discipline !== "all" && job.discipline !== discipline) return false;
      if (!matchesSearch(job, search)) return false;
      if (sources.size > 0 && !sources.has(job.source)) return false;
      if (location !== "all" && locationKey(job) !== location) return false;
      if (workMode !== "all" && jobWorkMode(job) !== workMode) return false;
      if (!passesCommon(job)) return false;
      return true;
    });
    // Re-sort only when not the default (allJobs is already newest-first).
    if (sort !== "newest") {
      filtered.sort((a, b) => compareBySort(a, b, sort));
    }
    return filtered;
  }, [allJobs, discipline, search, sources, location, workMode, sort, passesCommon]);

  /* ---------------------------- pagination ------------------------------- */
  // Reveal a window of cards; grow it on scroll / "Load more". The window
  // resets to one page whenever the filtered+sorted result set changes — a
  // signature string captures every input that reorders or refilters the list.
  const resetKey = useMemo(
    () =>
      [
        discipline,
        search.trim(),
        Array.from(sources).sort().join(","),
        location,
        workMode,
        fresherOnly,
        hasSalaryOnly,
        topOnly,
        savedOnly,
        status,
        sort,
        // saved/status views depend on the tracker map, so fold its size in
        savedOnly || status !== "all" ? tracker.savedCount : 0,
      ].join("|"),
    [
      discipline,
      search,
      sources,
      location,
      workMode,
      fresherOnly,
      hasSalaryOnly,
      topOnly,
      savedOnly,
      status,
      sort,
      tracker.savedCount,
    ]
  );

  const [shown, setShown] = useState(PAGE_SIZE);
  useEffect(() => {
    setShown(PAGE_SIZE); // any filter/search/sort change → back to the top window
  }, [resetKey]);

  const pageJobs = useMemo(() => visible.slice(0, shown), [visible, shown]);
  const remaining = Math.max(0, visible.length - pageJobs.length);
  const showMore = () => setShown((n) => n + PAGE_SIZE);

  /* --------------------- deep-link: ?job=<id> ↔ modal -------------------- */
  // When the data and the URL param are both present, open that job's modal.
  // Guarded updates (functional set + identity check) make re-runs no-ops.
  const { selectedJobId, setSelectedJobId } = f;
  useEffect(() => {
    if (state !== "ready") return;
    if (selectedJobId) {
      const job = byId.get(selectedJobId) ?? null;
      setSelectedJob((cur) => (cur?.id === selectedJobId ? cur : job));
      // If the id doesn't resolve (stale link), clear it from the URL.
      if (!job) setSelectedJobId(null);
    } else {
      setSelectedJob((cur) => (cur === null ? cur : null));
    }
  }, [state, selectedJobId, byId, setSelectedJobId]);

  // Opening a card → set the URL param (the effect above renders the modal).
  const openJob = (job: Job) => {
    setSelectedJob(job);
    f.setSelectedJobId(job.id);
  };
  const closeJob = () => {
    setSelectedJob(null);
    f.setSelectedJobId(null);
  };

  /* ------------------------------ handlers ------------------------------- */
  const toggleSource = (src: Source) => f.toggleSource(src);
  const clearSources = () => f.clearSources();
  const resetAll = () => f.reset();

  /* ----------------------------- result label ---------------------------- */
  const total = feed?.count ?? allJobs.length;
  const resultLabel = useMemo(() => {
    const n = visible.length.toLocaleString("en-IN");
    const t = total.toLocaleString("en-IN");
    const noun = visible.length === 1 ? "role" : "roles";
    if (!f.hasActiveFilters) return `Showing ${n} ${noun}`;
    return `Showing ${n} of ${t} ${noun}`;
  }, [visible.length, total, f.hasActiveFilters]);

  const loadedLabel = `Showing ${pageJobs.length.toLocaleString(
    "en-IN"
  )} of ${visible.length.toLocaleString("en-IN")}`;

  const loading = state === "loading";

  // Whether to surface the status filter row: in the saved view, or when a
  // status is already selected (so it stays togglable from any view).
  const showStatusFilter = savedOnly || status !== "all";

  /* -------------------------------- render ------------------------------- */
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <Header
          total={total}
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

        {/* glass filter bar (scrolls away with the page) */}
        <div className="mt-5">
          <div className="dod-glass dod-glass--silver rounded-2xl p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              {/* search + location + sort */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <SearchInput value={search} onChange={f.setSearch} />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <LocationFilterSelect
                    value={location}
                    counts={locationCounts}
                    onChange={f.setLocation}
                  />
                  <SortControl value={sort} onChange={f.setSort} />
                </div>
              </div>

              {/* work-type chips */}
              <div className="border-t border-[var(--silver-line)] pt-3">
                <WorkTypeFilter
                  value={workMode}
                  counts={workModeCounts}
                  onChange={f.setWorkMode}
                />
              </div>

              {/* fresher / has-salary / saved toggles + share */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--silver-line)] pt-3">
                <FilterChips
                  fresherOnly={fresherOnly}
                  hasSalaryOnly={hasSalaryOnly}
                  topOnly={topOnly}
                  topCount={topCount}
                  savedOnly={savedOnly}
                  savedCount={tracker.savedCount}
                  onFresher={() => f.setFresherOnly(!fresherOnly)}
                  onHasSalary={() => f.setHasSalaryOnly(!hasSalaryOnly)}
                  onTop={() => f.setTopOnly(!topOnly)}
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

        {/* featured companies strip — top companies currently in the feed */}
        {!loading && state !== "error" && (
          <FeaturedCompanies jobs={topJobs} onPick={(name) => f.setSearch(name)} />
        )}

        {/* active-filters summary */}
        {f.hasActiveFilters && !loading && state !== "error" && (
          <div className="mt-4">
            <ActiveFilters
              discipline={discipline}
              search={search}
              sources={sources}
              location={location}
              workMode={workMode}
              fresherOnly={fresherOnly}
              hasSalaryOnly={hasSalaryOnly}
              topOnly={topOnly}
              savedOnly={savedOnly}
              status={status}
              onClearDiscipline={() => f.setDiscipline("all")}
              onClearSearch={() => f.setSearch("")}
              onRemoveSource={(s) => f.toggleSource(s)}
              onClearLocation={() => f.setLocation("all")}
              onClearWorkMode={() => f.setWorkMode("all")}
              onClearFresher={() => f.setFresherOnly(false)}
              onClearHasSalary={() => f.setHasSalaryOnly(false)}
              onClearTop={() => f.setTopOnly(false)}
              onClearSaved={() => f.setSavedOnly(false)}
              onClearStatus={() => f.setStatus("all")}
              onClearAll={resetAll}
            />
          </div>
        )}

        {/* result count row */}
        <div className="mt-5 flex min-h-6 items-center justify-between gap-3">
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
                "shrink-0 text-xs font-medium text-white/50 transition-colors hover:text-white",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:rounded"
              )}
            >
              Clear all
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
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pageJobs.map((job, i) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    index={i}
                    onOpen={openJob}
                  />
                ))}
              </div>
              <LoadMore
                onMore={showMore}
                remaining={remaining}
                loadedLabel={loadedLabel}
              />
            </>
          )}
        </div>
      </div>

      <SiteFooter
        total={total}
        generatedAt={feed?.generated_at ?? null}
        loading={loading}
      />

      {/* detail modal — portal-free overlay, rendered above all content */}
      <JobDetailModal job={selectedJob} onClose={closeJob} />
    </>
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
