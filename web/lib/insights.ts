import { buildCompanies, companySlug } from "./companies";
import {
  DISCIPLINES,
  effectiveTime,
  hasSalary,
  LOCATION_LABELS,
  locationKey,
  normalizeCompany,
  SOURCE_ORDER,
} from "./jobs";
import type { LocationKey } from "./jobs";
import type { Discipline, Job, Source } from "./types";

/* ------------------------------------------------------------------ */
/*  Insights — pure deterministic analytics over the jobs feed         */
/*  (no ML, no network). All counts are derived straight from Job[].   */
/* ------------------------------------------------------------------ */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;

export interface SourceCount {
  source: Source;
  count: number;
}

export interface DisciplineCount {
  discipline: Discipline;
  label: string;
  count: number;
}

export interface CityCount {
  key: LocationKey;
  label: string;
  count: number;
}

export interface TrendingCompany {
  slug: string;
  name: string;
  logo: string | null;
  /** Roles whose effectiveTime is within the last 14 days. */
  recentCount: number;
  /** Total roles at this company in the feed. */
  totalCount: number;
}

export interface Insights {
  total: number;
  newThisWeek: number;
  companies: number;
  sourcesLive: number;
  perSource: SourceCount[];
  perDiscipline: DisciplineCount[];
  topCities: CityCount[];
  salaryCoveragePct: number;
  trendingCompanies: TrendingCompany[];
}

/**
 * Compute the full insights model from the loaded feed. `now` is injectable so
 * the "within 7d / 14d" windows stay deterministic in tests; production callers
 * use the build-time clock.
 */
export function computeInsights(
  jobs: Job[],
  now: number = Date.now()
): Insights {
  const total = jobs.length;

  /* ---- new this week (effectiveTime within last 7 days) ---- */
  let newThisWeek = 0;
  for (const job of jobs) {
    const t = effectiveTime(job);
    if (t > 0 && now - t >= 0 && now - t <= WEEK_MS) newThisWeek += 1;
  }

  /* ---- distinct companies (non-null, normalised) ---- */
  const companyKeys = new Set<string>();
  for (const job of jobs) {
    const original = job.company?.trim();
    if (!original) continue;
    const key = normalizeCompany(original) || original.toLowerCase();
    if (key) companyKeys.add(key);
  }
  const companies = companyKeys.size;

  /* ---- per-source counts (desc) ---- */
  const sourceMap = new Map<Source, number>();
  for (const job of jobs) {
    sourceMap.set(job.source, (sourceMap.get(job.source) ?? 0) + 1);
  }
  const perSource: SourceCount[] = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort(
      (a, b) =>
        b.count - a.count || a.source.localeCompare(b.source, "en")
    );
  const sourcesLive = perSource.filter((s) => s.count > 0).length;

  /* ---- per-discipline counts (the canonical 4, in display order) ---- */
  const discMap = new Map<Discipline, number>();
  for (const job of jobs) {
    discMap.set(job.discipline, (discMap.get(job.discipline) ?? 0) + 1);
  }
  const perDiscipline: DisciplineCount[] = DISCIPLINES.map((d) => ({
    discipline: d.key,
    label: d.label,
    count: discMap.get(d.key) ?? 0,
  }));

  /* ---- top cities (locationKey buckets, excl. "other"/blank), top 8 ---- */
  const cityMap = new Map<LocationKey, number>();
  for (const job of jobs) {
    const key = locationKey(job);
    if (key === "other") continue;
    cityMap.set(key, (cityMap.get(key) ?? 0) + 1);
  }
  const topCities: CityCount[] = Array.from(cityMap.entries())
    .map(([key, count]) => ({ key, label: LOCATION_LABELS[key], count }))
    .sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, "en")
    )
    .slice(0, 8);

  /* ---- salary coverage % ---- */
  const withSalary = jobs.reduce((n, j) => n + (hasSalary(j) ? 1 : 0), 0);
  const salaryCoveragePct =
    total > 0 ? Math.round((withSalary / total) * 100) : 0;

  /* ---- trending companies: rank by recent (14d) role count ---- */
  // Reuse buildCompanies for canonical display name + logo + slug (incl. unique
  // slug suffixing), then layer a per-company recent-count on top.
  const companiesAll = buildCompanies(jobs);
  const recentByKey = new Map<string, number>();
  for (const job of jobs) {
    const original = job.company?.trim();
    if (!original) continue;
    const key = normalizeCompany(original) || original.toLowerCase();
    if (!key) continue;
    const t = effectiveTime(job);
    if (t > 0 && now - t >= 0 && now - t <= FORTNIGHT_MS) {
      recentByKey.set(key, (recentByKey.get(key) ?? 0) + 1);
    }
  }
  const trendingCompanies: TrendingCompany[] = companiesAll
    .map((c) => {
      const key = normalizeCompany(c.name) || c.name.toLowerCase();
      return {
        slug: c.slug,
        name: c.name,
        logo: c.logo,
        recentCount: recentByKey.get(key) ?? 0,
        totalCount: c.count,
      };
    })
    .filter((c) => c.recentCount > 0)
    .sort(
      (a, b) =>
        b.recentCount - a.recentCount ||
        b.totalCount - a.totalCount ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    )
    .slice(0, 10);

  return {
    total,
    newThisWeek,
    companies,
    sourcesLive,
    perSource,
    perDiscipline,
    topCities,
    salaryCoveragePct,
    trendingCompanies,
  };
}

/* ------------------------------------------------------------------ */
/*  Source health — uses stats-history snapshots                       */
/* ------------------------------------------------------------------ */

export interface SourceHealthRow {
  source: Source;
  /** Latest-snapshot count for this source (0 if absent in the latest run). */
  count: number;
  /** A KNOWN source (SOURCE_ORDER) that returned 0 in the latest snapshot. */
  noResults: boolean;
  /** Signed change vs the earliest available snapshot (null if only 1 snap). */
  delta: number | null;
}

export interface SourceHealth {
  /** Most recent snapshot date ("YYYY-MM-DD"), or null when no history. */
  latestDate: string | null;
  /** Earliest snapshot date ("YYYY-MM-DD"), or null when no history. */
  earliestDate: string | null;
  /** Whether more than one snapshot exists (enables trend deltas). */
  hasTrend: boolean;
  /** One row per KNOWN source (SOURCE_ORDER order), plus any extra live ones. */
  rows: SourceHealthRow[];
  /** Max count across rows, for proportional bars (≥1 to avoid /0). */
  max: number;
}

/**
 * Derive source-health from the daily snapshots. The latest entry is the most
 * recent date; trend is measured against the earliest available snapshot. With
 * a single snapshot there's no delta (callers show "tracking since {date}").
 * Handles 0, 1, or N snapshots gracefully. Rows cover every KNOWN source so a
 * source that has gone to zero still shows a ⚠️ pill.
 */
export function computeSourceHealth(
  history: { date: string; per_source: Record<string, number> }[]
): SourceHealth {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      latestDate: null,
      earliestDate: null,
      hasTrend: false,
      rows: SOURCE_ORDER.map((source) => ({
        source,
        count: 0,
        noResults: true,
        delta: null,
      })),
      max: 1,
    };
  }

  // Sort by date ascending so earliest = [0], latest = [last] regardless of
  // the file's stored order.
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const hasTrend = sorted.length > 1;

  // Known sources first (fixed order), then any extra source seen in the latest
  // snapshot that isn't in SOURCE_ORDER (defensive — keeps the page complete).
  const extra = Object.keys(latest.per_source).filter(
    (s) => !(SOURCE_ORDER as string[]).includes(s)
  );
  const allSources = [...SOURCE_ORDER, ...(extra as Source[])];

  const rows: SourceHealthRow[] = allSources.map((source) => {
    const count = latest.per_source[source] ?? 0;
    const known = (SOURCE_ORDER as string[]).includes(source);
    const delta = hasTrend
      ? count - (earliest.per_source[source] ?? 0)
      : null;
    return {
      source,
      count,
      noResults: known && count === 0,
      delta,
    };
  });

  const max = Math.max(1, ...rows.map((r) => r.count));

  return {
    latestDate: latest.date,
    earliestDate: earliest.date,
    hasTrend,
    rows,
    max,
  };
}

/** Re-export for convenience so pages can build company hrefs consistently. */
export { companySlug };
