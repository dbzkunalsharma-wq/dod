"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Discipline, Source } from "./types";
import type { JobStatus } from "./useTracker";

/**
 * Single source of truth for the board's filter state, kept in sync with the
 * URL query string so any view is shareable / restorable.
 *
 * Strategy: the URL is read **once** on mount to seed React state (the params
 * are the initial value, not a continuous subscription — that avoids loops and
 * input lag while typing). Thereafter local state is authoritative and is
 * mirrored back to the URL with `router.replace(..., { scroll: false })`, so
 * navigation history isn't polluted and the page never jumps.
 *
 * URL contract (all optional, omitted when at their default):
 *   d=uiux|product|communication|industrial   discipline (default "all")
 *   q=<text>                                   search query
 *   src=linkedin,unstop,…                      selected sources (CSV)
 *   fresher=1                                  fresher-friendly toggle
 *   intern=1                                   internships-only toggle
 *   view=saved                                 saved-only view
 *   status=interested|applied|rejected         status filter
 */

export type DisciplineFilter = "all" | Discipline;
export type StatusFilter = "all" | Exclude<JobStatus, "none">;

const DISCIPLINE_VALUES: Discipline[] = [
  "uiux",
  "product",
  "communication",
  "industrial",
];

const STATUS_VALUES: Exclude<JobStatus, "none">[] = [
  "interested",
  "applied",
  "rejected",
];

export interface FilterState {
  discipline: DisciplineFilter;
  search: string;
  sources: Set<Source>;
  fresherOnly: boolean;
  internOnly: boolean;
  savedOnly: boolean;
  status: StatusFilter;
}

function parseInitial(params: URLSearchParams): FilterState {
  const d = params.get("d");
  const discipline: DisciplineFilter =
    d && (DISCIPLINE_VALUES as string[]).includes(d)
      ? (d as Discipline)
      : "all";

  const src = params.get("src");
  const sources = new Set<Source>(
    src
      ? (src
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean) as Source[])
      : []
  );

  const st = params.get("status");
  const status: StatusFilter =
    st && (STATUS_VALUES as string[]).includes(st)
      ? (st as Exclude<JobStatus, "none">)
      : "all";

  return {
    discipline,
    search: params.get("q") ?? "",
    sources,
    fresherOnly: params.get("fresher") === "1",
    internOnly: params.get("intern") === "1",
    savedOnly: params.get("view") === "saved",
    status,
  };
}

function toQueryString(s: FilterState): string {
  const p = new URLSearchParams();
  if (s.discipline !== "all") p.set("d", s.discipline);
  if (s.search.trim()) p.set("q", s.search.trim());
  if (s.sources.size > 0) {
    // Stable, deterministic order so the same view → the same URL.
    p.set("src", Array.from(s.sources).sort().join(","));
  }
  if (s.fresherOnly) p.set("fresher", "1");
  if (s.internOnly) p.set("intern", "1");
  if (s.savedOnly) p.set("view", "saved");
  if (s.status !== "all") p.set("status", s.status);
  return p.toString();
}

export interface FilterApi extends FilterState {
  setDiscipline: (d: DisciplineFilter) => void;
  setSearch: (q: string) => void;
  toggleSource: (src: Source) => void;
  clearSources: () => void;
  setFresherOnly: (v: boolean) => void;
  setInternOnly: (v: boolean) => void;
  setSavedOnly: (v: boolean) => void;
  setStatus: (s: StatusFilter) => void;
  reset: () => void;
  /** Whether any filter departs from the default ("everything") view. */
  hasActiveFilters: boolean;
  /** Current query string (no leading "?"); "" when at defaults. */
  queryString: string;
}

const DEFAULT: FilterState = {
  discipline: "all",
  search: "",
  sources: new Set(),
  fresherOnly: false,
  internOnly: false,
  savedOnly: false,
  status: "all",
};

export function useFilterState(): FilterApi {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Seed once from the URL (read at mount). Reading inside the initializer
  // keeps it a one-shot — later URL changes don't fight local state.
  const [state, setState] = useState<FilterState>(() =>
    parseInitial(new URLSearchParams(searchParams.toString()))
  );

  // Mirror state → URL whenever it changes (skip the very first run so we
  // don't immediately rewrite the URL the user arrived with).
  const firstRun = useRef(true);
  const queryString = useMemo(() => toQueryString(state), [state]);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(url, { scroll: false });
  }, [queryString, pathname, router]);

  const setDiscipline = useCallback(
    (discipline: DisciplineFilter) =>
      setState((s) => ({ ...s, discipline })),
    []
  );
  const setSearch = useCallback(
    (search: string) => setState((s) => ({ ...s, search })),
    []
  );
  const toggleSource = useCallback(
    (src: Source) =>
      setState((s) => {
        const sources = new Set(s.sources);
        if (sources.has(src)) sources.delete(src);
        else sources.add(src);
        return { ...s, sources };
      }),
    []
  );
  const clearSources = useCallback(
    () => setState((s) => ({ ...s, sources: new Set() })),
    []
  );
  const setFresherOnly = useCallback(
    (fresherOnly: boolean) => setState((s) => ({ ...s, fresherOnly })),
    []
  );
  const setInternOnly = useCallback(
    (internOnly: boolean) => setState((s) => ({ ...s, internOnly })),
    []
  );
  const setSavedOnly = useCallback(
    (savedOnly: boolean) => setState((s) => ({ ...s, savedOnly })),
    []
  );
  const setStatus = useCallback(
    (status: StatusFilter) => setState((s) => ({ ...s, status })),
    []
  );
  const reset = useCallback(
    () => setState({ ...DEFAULT, sources: new Set() }),
    []
  );

  const hasActiveFilters =
    state.discipline !== "all" ||
    state.search.trim() !== "" ||
    state.sources.size > 0 ||
    state.fresherOnly ||
    state.internOnly ||
    state.savedOnly ||
    state.status !== "all";

  return {
    ...state,
    setDiscipline,
    setSearch,
    toggleSource,
    clearSources,
    setFresherOnly,
    setInternOnly,
    setSavedOnly,
    setStatus,
    reset,
    hasActiveFilters,
    queryString,
  };
}
