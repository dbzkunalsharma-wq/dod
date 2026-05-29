import { buildCompanies, companySlug } from "./companies";
import {
  DISCIPLINES,
  effectiveTime,
  EXPERIENCE_LEVELS,
  experienceLevel,
  hasSalary,
  LOCATION_LABELS,
  locationKey,
  normalizeCompany,
  SOURCE_ORDER,
} from "./jobs";
import type { ExperienceLevel, LocationKey } from "./jobs";
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

/**
 * One salary slice — overall, or per discipline / experience level / city. A
 * slice with `count < SALARY_MIN_SAMPLE` is marked `na` (no median shown) so we
 * never publish a misleading stat off 1–2 data points. `median`/`p25`/`p75` are
 * monthly ₹ (the unit disclosed pay is actually in); render via `formatPay`.
 */
export interface SalarySlice {
  /** Slice label (e.g. "UI/UX", "Senior", "Bengaluru"). */
  label: string;
  /** Roles in this slice that disclose a parseable salary. */
  count: number;
  /** True when `count < SALARY_MIN_SAMPLE` — show "n/a", hide the bar. */
  na: boolean;
  /** Monthly ₹ median (0 when `na`). */
  median: number;
  /** Monthly ₹ 25th / 75th percentile (0 when `na`). */
  p25: number;
  p75: number;
}

export interface SalaryStats {
  /** Roles with a parseable salary (`salaryValue > 0`). */
  count: number;
  /** Total roles in the feed (denominator for coverage). */
  total: number;
  /** Coverage as a whole-number percent of `total`. */
  coveragePct: number;
  /** Overall slice across every disclosed-pay role (na when too sparse). */
  overall: SalarySlice;
  /** Median + range per discipline (canonical 4, display order). */
  byDiscipline: SalarySlice[];
  /** Median + range per experience level (intern → senior). */
  byExperience: SalarySlice[];
  /** Median + range for the top cities by disclosed-pay sample (desc). */
  byCity: SalarySlice[];
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
  salary: SalaryStats;
  trendingCompanies: TrendingCompany[];
}

/** Minimum disclosed-pay sample for a slice to show a median (else "n/a"). */
export const SALARY_MIN_SAMPLE = 3;

/**
 * Linear-interpolated percentile of a *sorted* ascending number array. `p` in
 * [0,1]. Empty → 0. Matches the common "type 7" quantile used by NumPy/Excel.
 */
function percentile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  const idx = (n - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Build a salary slice from a set of annualised ₹ values. Below
 * `SALARY_MIN_SAMPLE` we return an `na` slice (no median) so a 1–2 sample never
 * masquerades as a real figure.
 */
function makeSlice(label: string, values: number[]): SalarySlice {
  const count = values.length;
  if (count < SALARY_MIN_SAMPLE) {
    return { label, count, na: true, median: 0, p25: 0, p75: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    label,
    count,
    na: false,
    median: Math.round(percentile(sorted, 0.5)),
    p25: Math.round(percentile(sorted, 0.25)),
    p75: Math.round(percentile(sorted, 0.75)),
  };
}

/**
 * Format a MONTHLY ₹ figure for display, e.g. "₹15,000/mo". Disclosed pay in
 * this feed is overwhelmingly monthly stipends / junior wages, so we report
 * per-month rather than annualising (which would turn a ₹15k/mo stipend into a
 * misleading figure). Returns "—" for non-positive input.
 */
export function formatPay(monthlyINR: number): string {
  if (!monthlyINR || monthlyINR <= 0) return "—";
  return `₹${Math.round(monthlyINR).toLocaleString("en-IN")}/mo`;
}

/** Plain Indian-grouped ₹ amount (no unit suffix). */
export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/**
 * Best-effort MONTHLY ₹ figure from a free-text pay string, or 0 if none/uncertain.
 * The disclosed-pay slice of this feed is almost entirely internship stipends and
 * junior wages quoted per-month, so we normalise to ₹/month (the unit the data is
 * actually in) rather than annualising — annualising a stipend, or trusting a
 * board's mislabelled "/year", produces misleading "salary" numbers. Ranges use
 * the midpoint.
 *   - "Unpaid" / no number          → 0 (excluded)
 *   - "…LPA" / "lakh"               → annual ₹, ÷12 → monthly
 *   - "/month" / "stipend" / "p.m." → taken as monthly
 *   - "/year" / "annum", ≥ ₹1.5L    → annual, ÷12 → monthly
 *   - "/year" / "annum", < ₹1.5L    → implausible as annual; treated as monthly
 *                                     (Apna etc. mislabel monthly wages "/year")
 *   - unlabelled number             → 0 (too ambiguous to trust)
 */
export function monthlyPay(salary: string | null | undefined): number {
  if (!salary) return 0;
  const raw = salary.trim();
  const lower = raw.toLowerCase();
  if (!raw || /unpaid|no\s*stipend/.test(lower)) return 0;
  const nums = (raw.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? [])
    .map(Number)
    .filter((n) => n > 0);
  if (nums.length === 0) return 0;
  const mid = (Math.min(...nums) + Math.max(...nums)) / 2; // range → midpoint

  const isLpa = /\blpa\b|lakh|lac\b/.test(lower);
  const perMonth = /month|\/m\b|p\.?\s*m\b|monthly|stipend/.test(lower);
  const perYear = /year|\/yr\b|annum|annual|p\.?\s*a\b/.test(lower);

  if (isLpa) return Math.round((mid * 100_000) / 12);
  if (perMonth) return Math.round(mid);
  if (perYear) return Math.round(mid >= 150_000 ? mid / 12 : mid);
  return 0; // unlabelled → don't guess
}

/**
 * Salary stats over ONLY the roles whose `monthlyPay` parses to a positive
 * ₹/month figure (so "Unpaid" / blank / unlabelled rows are excluded). Honest +
 * directional: every slice below `SALARY_MIN_SAMPLE` is `na`. Cities reuse the
 * `locationKey` buckets; we keep the 6 best-sampled ones (desc by count).
 */
export function computeSalaryStats(jobs: Job[]): SalaryStats {
  const total = jobs.length;

  // Annotate each disclosed-pay role once.
  interface Priced {
    value: number;
    discipline: Discipline;
    experience: ExperienceLevel;
    city: LocationKey;
  }
  const priced: Priced[] = [];
  for (const job of jobs) {
    const value = monthlyPay(job.salary);
    if (value <= 0) continue;
    priced.push({
      value,
      discipline: job.discipline,
      experience: experienceLevel(job),
      city: locationKey(job),
    });
  }

  const count = priced.length;
  const coveragePct = total > 0 ? Math.round((count / total) * 100) : 0;

  const overall = makeSlice("Overall", priced.map((p) => p.value));

  const byDiscipline: SalarySlice[] = DISCIPLINES.map((d) =>
    makeSlice(
      d.label,
      priced.filter((p) => p.discipline === d.key).map((p) => p.value)
    )
  );

  const byExperience: SalarySlice[] = EXPERIENCE_LEVELS.map((e) =>
    makeSlice(
      e.label,
      priced.filter((p) => p.experience === e.key).map((p) => p.value)
    )
  );

  // Cities: bucket disclosed-pay roles (excl. "other"/blank), build a slice for
  // each, keep those with a usable sample, and surface the 6 best by count.
  const cityValues = new Map<LocationKey, number[]>();
  for (const p of priced) {
    if (p.city === "other") continue;
    const arr = cityValues.get(p.city);
    if (arr) arr.push(p.value);
    else cityValues.set(p.city, [p.value]);
  }
  const byCity: SalarySlice[] = Array.from(cityValues.entries())
    .map(([key, values]) => makeSlice(LOCATION_LABELS[key], values))
    .filter((s) => !s.na)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en"))
    .slice(0, 6);

  return {
    count,
    total,
    coveragePct,
    overall,
    byDiscipline,
    byExperience,
    byCity,
  };
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

  /* ---- salary stats (directional; over salaryValue>0 only) ---- */
  const salary = computeSalaryStats(jobs);

  return {
    total,
    newThisWeek,
    companies,
    sourcesLive,
    perSource,
    perDiscipline,
    topCities,
    salaryCoveragePct,
    salary,
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
