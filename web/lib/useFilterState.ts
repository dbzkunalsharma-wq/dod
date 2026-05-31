"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Discipline, Source } from "./types";
import type {
  ExperienceLevel,
  LocationKey,
  Specialization,
  WorkMode,
} from "./jobs";
import { SPECIALIZATIONS } from "./jobs";
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
 * The selected job (`?job=<id>`) is a special case: it must stay shareable but
 * is driven by the modal, which lives in the board. It's threaded through here
 * too so all URL state has one owner.
 *
 * URL contract (all optional, omitted when at their default):
 *   d=uiux|product|communication|industrial   discipline (default "all")
 *   q=<text>                                   search query
 *   src=linkedin,unstop,…                      selected sources (CSV)
 *   loc=bengaluru|delhi-ncr|…                  location facet (default "all")
 *   mode=remote|hybrid|onsite|internship       work-type facet (default "all")
 *   fresher=1                                  fresher-friendly toggle
 *   salary=1                                   has-salary-only toggle
 *   top=1                                      top-companies-only toggle
 *   posted=24h|7d|30d                          date-posted window (default "any")
 *   exp=intern,entry,mid,senior                experience levels (CSV)
 *   spec=ux-research,motion,…                   specializations (CSV)
 *   sort=newest|salary|company                  sort mode (default "top")
 *   view=saved                                 saved-only view
 *   status=interested|applied|rejected         status filter
 *   job=<id>                                   open this job's detail modal
 *
 * Back-compat: a legacy `intern=1` is read on mount and folded into
 * `mode=internship`.
 */

export type DisciplineFilter = "all" | Discipline;
export type StatusFilter = "all" | Exclude<JobStatus, "none">;
export type LocationFilter = "all" | LocationKey;
export type WorkModeFilter = "all" | WorkMode;
export type SortMode = "top" | "newest" | "salary" | "company";
/** Date-posted window. "any" (default) imposes no recency bound. */
export type DateFilter = "any" | "24h" | "7d" | "30d";

/** Days each non-"any" date window spans (used for the window math). */
export const DATE_FILTER_DAYS: Record<Exclude<DateFilter, "any">, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
};

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

const LOCATION_VALUES: LocationKey[] = [
  "bengaluru",
  "mumbai",
  "delhi-ncr",
  "hyderabad",
  "pune",
  "chennai",
  "kolkata",
  "ahmedabad",
  "remote",
  "other",
];

const WORK_MODE_VALUES: WorkMode[] = [
  "remote",
  "hybrid",
  "onsite",
  "internship",
];

const SORT_VALUES: SortMode[] = ["top", "newest", "salary", "company"];

const DATE_VALUES: DateFilter[] = ["any", "24h", "7d", "30d"];

const EXPERIENCE_VALUES: ExperienceLevel[] = [
  "intern",
  "entry",
  "mid",
  "senior",
];

/** Specialization keys, in the canonical display order from lib/jobs. */
const SPECIALIZATION_VALUES: Specialization[] = SPECIALIZATIONS.map(
  (s) => s.key
);

export interface FilterState {
  discipline: DisciplineFilter;
  search: string;
  sources: Set<Source>;
  location: LocationFilter;
  workMode: WorkModeFilter;
  fresherOnly: boolean;
  hasSalaryOnly: boolean;
  topOnly: boolean;
  savedOnly: boolean;
  status: StatusFilter;
  sort: SortMode;
  /** Date-posted recency window (default "any"). */
  datePosted: DateFilter;
  /** Selected experience levels (multi-select facet; empty = any). */
  experience: Set<ExperienceLevel>;
  /** Selected specializations (multi-select facet; empty = any). */
  specializations: Set<Specialization>;
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

  const loc = params.get("loc");
  const location: LocationFilter =
    loc && (LOCATION_VALUES as string[]).includes(loc)
      ? (loc as LocationKey)
      : "all";

  // Work mode, with legacy `intern=1` folded in.
  const modeRaw = params.get("mode");
  let workMode: WorkModeFilter =
    modeRaw && (WORK_MODE_VALUES as string[]).includes(modeRaw)
      ? (modeRaw as WorkMode)
      : "all";
  if (workMode === "all" && params.get("intern") === "1") {
    workMode = "internship";
  }

  const st = params.get("status");
  const status: StatusFilter =
    st && (STATUS_VALUES as string[]).includes(st)
      ? (st as Exclude<JobStatus, "none">)
      : "all";

  const sortRaw = params.get("sort");
  const sort: SortMode =
    sortRaw && (SORT_VALUES as string[]).includes(sortRaw)
      ? (sortRaw as SortMode)
      : "top";

  const postedRaw = params.get("posted");
  const datePosted: DateFilter =
    postedRaw && (DATE_VALUES as string[]).includes(postedRaw)
      ? (postedRaw as DateFilter)
      : "any";

  const expRaw = params.get("exp");
  const experience = new Set<ExperienceLevel>(
    expRaw
      ? (expRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) =>
            (EXPERIENCE_VALUES as string[]).includes(s)
          ) as ExperienceLevel[])
      : []
  );

  const specRaw = params.get("spec");
  const specializations = new Set<Specialization>(
    specRaw
      ? (specRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) =>
            (SPECIALIZATION_VALUES as string[]).includes(s)
          ) as Specialization[])
      : []
  );

  return {
    discipline,
    search: params.get("q") ?? "",
    sources,
    location,
    workMode,
    fresherOnly: params.get("fresher") === "1",
    hasSalaryOnly: params.get("salary") === "1",
    topOnly: params.get("top") === "1",
    savedOnly: params.get("view") === "saved",
    status,
    sort,
    datePosted,
    experience,
    specializations,
  };
}

/**
 * Serialise filter state to a query string. The selected `job` id is passed
 * separately so the modal can update only that param without re-deriving the
 * whole filter state.
 */
function toQueryString(s: FilterState, job: string | null): string {
  const p = new URLSearchParams();
  if (s.discipline !== "all") p.set("d", s.discipline);
  if (s.search.trim()) p.set("q", s.search.trim());
  if (s.sources.size > 0) {
    // Stable, deterministic order so the same view → the same URL.
    p.set("src", Array.from(s.sources).sort().join(","));
  }
  if (s.location !== "all") p.set("loc", s.location);
  if (s.workMode !== "all") p.set("mode", s.workMode);
  if (s.fresherOnly) p.set("fresher", "1");
  if (s.hasSalaryOnly) p.set("salary", "1");
  if (s.topOnly) p.set("top", "1");
  if (s.datePosted !== "any") p.set("posted", s.datePosted);
  if (s.experience.size > 0) {
    // Stable, deterministic order so the same view → the same URL.
    p.set(
      "exp",
      EXPERIENCE_VALUES.filter((e) => s.experience.has(e)).join(",")
    );
  }
  if (s.specializations.size > 0) {
    // Stable, deterministic order so the same view → the same URL.
    p.set(
      "spec",
      SPECIALIZATION_VALUES.filter((k) => s.specializations.has(k)).join(",")
    );
  }
  if (s.savedOnly) p.set("view", "saved");
  if (s.status !== "all") p.set("status", s.status);
  if (s.sort !== "top") p.set("sort", s.sort);
  if (job) p.set("job", job);
  return p.toString();
}

export interface FilterApi extends FilterState {
  setDiscipline: (d: DisciplineFilter) => void;
  setSearch: (q: string) => void;
  toggleSource: (src: Source) => void;
  clearSources: () => void;
  setLocation: (loc: LocationFilter) => void;
  setWorkMode: (mode: WorkModeFilter) => void;
  setFresherOnly: (v: boolean) => void;
  setHasSalaryOnly: (v: boolean) => void;
  setTopOnly: (v: boolean) => void;
  setSavedOnly: (v: boolean) => void;
  setStatus: (s: StatusFilter) => void;
  setSort: (s: SortMode) => void;
  setDatePosted: (d: DateFilter) => void;
  toggleExperience: (level: ExperienceLevel) => void;
  clearExperience: () => void;
  toggleSpecialization: (key: Specialization) => void;
  clearSpecializations: () => void;
  reset: () => void;
  /** The job id whose modal is open (from `?job=`), or null. */
  selectedJobId: string | null;
  /** Set / clear the `?job=` deep-link param (drives the detail modal). */
  setSelectedJobId: (id: string | null) => void;
  /** Whether any filter departs from the default ("everything") view. */
  hasActiveFilters: boolean;
  /** Current query string (no leading "?"), excluding the `job` param. */
  queryString: string;
}

const DEFAULT: FilterState = {
  discipline: "all",
  search: "",
  sources: new Set(),
  location: "all",
  workMode: "all",
  fresherOnly: false,
  hasSalaryOnly: false,
  topOnly: false,
  savedOnly: false,
  status: "all",
  sort: "top",
  datePosted: "any",
  experience: new Set(),
  specializations: new Set(),
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
  const [selectedJobId, setSelectedJobIdState] = useState<string | null>(
    () => searchParams.get("job") || null
  );

  // Mirror state → URL whenever it changes (skip the very first run so we
  // don't immediately rewrite the URL the user arrived with).
  const firstRun = useRef(true);
  // The shareable filter query string never includes `job` (so "Copy link"
  // on the filter bar shares the *view*, not whatever modal is open).
  const queryString = useMemo(() => toQueryString(state, null), [state]);
  // The full string (with `job`) is what we actually write to the URL.
  const fullQuery = useMemo(
    () => toQueryString(state, selectedJobId),
    [state, selectedJobId]
  );

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const url = fullQuery ? `${pathname}?${fullQuery}` : pathname;
    router.replace(url, { scroll: false });
  }, [fullQuery, pathname, router]);

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
  const setLocation = useCallback(
    (location: LocationFilter) => setState((s) => ({ ...s, location })),
    []
  );
  const setWorkMode = useCallback(
    (workMode: WorkModeFilter) => setState((s) => ({ ...s, workMode })),
    []
  );
  const setFresherOnly = useCallback(
    (fresherOnly: boolean) => setState((s) => ({ ...s, fresherOnly })),
    []
  );
  const setHasSalaryOnly = useCallback(
    (hasSalaryOnly: boolean) => setState((s) => ({ ...s, hasSalaryOnly })),
    []
  );
  const setTopOnly = useCallback(
    (topOnly: boolean) => setState((s) => ({ ...s, topOnly })),
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
  const setSort = useCallback(
    (sort: SortMode) => setState((s) => ({ ...s, sort })),
    []
  );
  const setDatePosted = useCallback(
    (datePosted: DateFilter) => setState((s) => ({ ...s, datePosted })),
    []
  );
  const toggleExperience = useCallback(
    (level: ExperienceLevel) =>
      setState((s) => {
        const experience = new Set(s.experience);
        if (experience.has(level)) experience.delete(level);
        else experience.add(level);
        return { ...s, experience };
      }),
    []
  );
  const clearExperience = useCallback(
    () => setState((s) => ({ ...s, experience: new Set() })),
    []
  );
  const toggleSpecialization = useCallback(
    (key: Specialization) =>
      setState((s) => {
        const specializations = new Set(s.specializations);
        if (specializations.has(key)) specializations.delete(key);
        else specializations.add(key);
        return { ...s, specializations };
      }),
    []
  );
  const clearSpecializations = useCallback(
    () => setState((s) => ({ ...s, specializations: new Set() })),
    []
  );
  const setSelectedJobId = useCallback(
    (id: string | null) => setSelectedJobIdState(id),
    []
  );
  const reset = useCallback(
    () =>
      setState({
        ...DEFAULT,
        sources: new Set(),
        experience: new Set(),
        specializations: new Set(),
      }),
    []
  );

  const hasActiveFilters =
    state.discipline !== "all" ||
    state.search.trim() !== "" ||
    state.sources.size > 0 ||
    state.location !== "all" ||
    state.workMode !== "all" ||
    state.fresherOnly ||
    state.hasSalaryOnly ||
    state.topOnly ||
    state.savedOnly ||
    state.status !== "all" ||
    state.datePosted !== "any" ||
    state.experience.size > 0 ||
    state.specializations.size > 0;

  return {
    ...state,
    setDiscipline,
    setSearch,
    toggleSource,
    clearSources,
    setLocation,
    setWorkMode,
    setFresherOnly,
    setHasSalaryOnly,
    setTopOnly,
    setSavedOnly,
    setStatus,
    setSort,
    setDatePosted,
    toggleExperience,
    clearExperience,
    toggleSpecialization,
    clearSpecializations,
    reset,
    selectedJobId,
    setSelectedJobId,
    hasActiveFilters,
    queryString,
  };
}
