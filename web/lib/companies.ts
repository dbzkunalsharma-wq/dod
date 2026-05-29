import {
  effectiveTime,
  isTopCompany,
  normalizeCompany,
} from "./jobs";
import type { Discipline, Job } from "./types";

/* ------------------------------------------------------------------ */
/*  Company directory model (deterministic, no ML)                     */
/*                                                                     */
/*  Groups the flat jobs feed by a *normalised* company identity (the  */
/*  same suffix-stripped key `isTopCompany` uses, so "Razorpay Pvt     */
/*  Ltd" and "Razorpay" collapse together) and derives a per-company   */
/*  summary for the SSG company directory + per-company pages.         */
/* ------------------------------------------------------------------ */

export interface CompanySummary {
  /** URL-safe slug: lowercase [a-z0-9-] only (see `companySlug`). Unique. */
  slug: string;
  /** Display name — the most frequent original spelling in the feed. */
  name: string;
  /** Number of roles at this company in the current feed. */
  count: number;
  /** Distinct disciplines this company hires across. */
  disciplines: Discipline[];
  /** Distinct non-blank location strings seen for this company. */
  locations: string[];
  /** First non-null logo URL across the company's roles (or null). */
  logo: string | null;
  /** Whether this is one of the curated top companies. */
  isTop: boolean;
  /** Max effectiveTime across the company's roles (epoch ms). */
  latestTime: number;
}

/**
 * URL/route slug for a company name — route-param safe: lowercase, `[a-z0-9-]`
 * only, no colons / spaces / encoding (the same hard rule that `jobSlug`
 * follows for per-job URLs). We:
 *   1. fold accents + lowercase,
 *   2. expand "&" → "and" (so it survives the alnum filter as a word),
 *   3. strip common legal / noise suffixes ("pvt ltd", "private limited",
 *      "inc", "llp", "technologies", …) as *whole words*,
 *   4. replace every run of non-alphanumerics with a single "-", and
 *   5. trim leading/trailing hyphens.
 * Returns "" only for a name with no usable alphanumerics (callers guard).
 */
export function companySlug(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(
      /\b(pvt|private|ltd|limited|inc|incorporated|llc|llp|co|corp|corporation|company|technologies|technology|technolabs|solutions|systems)\b/g,
      " "
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build the company directory from the flat jobs feed. Jobs with a null/blank
 * company are skipped. Within each normalised-name group we pick:
 *   - display name = the most frequent original spelling (ties → first seen),
 *   - logo = the first non-null logo encountered,
 *   - disciplines = distinct, in first-seen order,
 *   - locations = distinct non-blank location strings, in first-seen order,
 *   - latestTime = max effectiveTime, isTop = isTopCompany(name).
 *
 * Slugs are made UNIQUE deterministically: if two groups slugify to the same
 * string (or a name yields an empty slug), later collisions get a "-2", "-3", …
 * suffix in sorted order. Final sort: top companies first, then count desc,
 * then name A–Z.
 */
export function buildCompanies(jobs: Job[]): CompanySummary[] {
  interface Acc {
    key: string;
    /** original spelling → occurrences, to pick the most frequent display name. */
    names: Map<string, number>;
    /** first-seen order index, so ties in name frequency are stable. */
    firstNameOrder: Map<string, number>;
    count: number;
    disciplines: Set<Discipline>;
    locations: Set<string>;
    logo: string | null;
    latestTime: number;
  }

  const groups = new Map<string, Acc>();

  for (const job of jobs) {
    const original = job.company?.trim();
    if (!original) continue;
    const key = normalizeCompany(original) || original.toLowerCase();
    if (!key) continue;

    let acc = groups.get(key);
    if (!acc) {
      acc = {
        key,
        names: new Map(),
        firstNameOrder: new Map(),
        count: 0,
        disciplines: new Set(),
        locations: new Set(),
        logo: null,
        latestTime: 0,
      };
      groups.set(key, acc);
    }

    acc.count += 1;
    acc.names.set(original, (acc.names.get(original) ?? 0) + 1);
    if (!acc.firstNameOrder.has(original)) {
      acc.firstNameOrder.set(original, acc.firstNameOrder.size);
    }
    acc.disciplines.add(job.discipline);
    const loc = job.location?.trim();
    if (loc) acc.locations.add(loc);
    if (!acc.logo && job.logo && job.logo.trim()) acc.logo = job.logo.trim();
    const t = effectiveTime(job);
    if (t > acc.latestTime) acc.latestTime = t;
  }

  // Resolve each group to a summary with a provisional (pre-uniqueness) slug.
  const summaries = Array.from(groups.values()).map((acc) => {
    // Most frequent original spelling; ties broken by earliest first-seen.
    let name = "";
    let bestCount = -1;
    let bestOrder = Number.POSITIVE_INFINITY;
    for (const [spelling, n] of acc.names) {
      const order = acc.firstNameOrder.get(spelling) ?? 0;
      if (n > bestCount || (n === bestCount && order < bestOrder)) {
        name = spelling;
        bestCount = n;
        bestOrder = order;
      }
    }
    return {
      slug: companySlug(name) || acc.key.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      name,
      count: acc.count,
      disciplines: Array.from(acc.disciplines),
      locations: Array.from(acc.locations),
      logo: acc.logo,
      isTop: isTopCompany(name),
      latestTime: acc.latestTime,
    } satisfies CompanySummary;
  });

  // Final ordering: top first, then count desc, then name A–Z. This is also the
  // order in which slug collisions are de-duped, so the suffixing is stable.
  summaries.sort(
    (a, b) =>
      Number(b.isTop) - Number(a.isTop) ||
      b.count - a.count ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  );

  // Ensure slugs are unique: keep the first occurrence's slug, suffix later
  // collisions "-2", "-3", … Empty slugs fall back to "company" before suffixing.
  const used = new Map<string, number>();
  for (const s of summaries) {
    const base = s.slug || "company";
    if (!used.has(base)) {
      used.set(base, 1);
      s.slug = base;
    } else {
      let n = used.get(base)! + 1;
      let candidate = `${base}-${n}`;
      while (used.has(candidate)) {
        n += 1;
        candidate = `${base}-${n}`;
      }
      used.set(base, n);
      used.set(candidate, 1);
      s.slug = candidate;
    }
  }

  return summaries;
}

/** The normalized grouping key for a company string (mirrors buildCompanies). */
function companyKey(company: string): string {
  return normalizeCompany(company) || company.toLowerCase();
}

/**
 * A single company (by slug) plus its roles, or null if the slug is unknown.
 * Roles are returned newest-first (by effectiveTime). Reuses `buildCompanies`
 * so the slug↔company mapping (incl. uniqueness suffixing) matches the
 * directory exactly.
 *
 * Resolution is tolerant of *member-spelling* slugs: the canonical page slug is
 * derived from a group's most-frequent spelling, but an in-app link built from
 * a single job's (possibly different) spelling — e.g. a "Google" role whose
 * canonical group page is `/companies/google-india` — slugifies differently.
 * To never 404 a real link, we also match a company when the requested slug
 * equals `companySlug` of ANY original spelling in that group. The canonical
 * `<link rel="canonical">` on the page still points at the canonical slug, so
 * these alias URLs dedupe cleanly for SEO.
 */
export function getCompanyBySlug(
  slug: string,
  jobs: Job[]
): (CompanySummary & { jobs: Job[] }) | null {
  const companies = buildCompanies(jobs);

  // 1) Exact canonical-slug match (the prerendered case).
  let company = companies.find((c) => c.slug === slug) ?? null;

  // 2) Fallback: a member spelling whose slug equals the requested one. Map the
  //    requested slug → normalized group key → canonical company.
  if (!company) {
    let matchKey: string | null = null;
    for (const j of jobs) {
      const original = j.company?.trim();
      if (!original) continue;
      if (companySlug(original) === slug) {
        matchKey = companyKey(original);
        break;
      }
    }
    if (matchKey) {
      company =
        companies.find(
          (c) => companyKey(c.name) === matchKey
        ) ?? null;
    }
  }

  if (!company) return null;

  const key = companyKey(company.name);
  const companyJobs = jobs
    .filter((j) => {
      const original = j.company?.trim();
      if (!original) return false;
      return companyKey(original) === key;
    })
    .sort((a, b) => effectiveTime(b) - effectiveTime(a));

  return { ...company, jobs: companyJobs };
}
