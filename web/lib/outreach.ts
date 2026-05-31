import { buildCompanies, type CompanySummary } from "./companies";
import {
  DISCIPLINE_MAP,
  LOCATION_LABELS,
  effectiveTime,
  guessDomain,
  locationKey,
  normalizeCompany,
  reputationTier,
} from "./jobs";
import type { Discipline, Job } from "./types";

/* ------------------------------------------------------------------ */
/*  Placement-outreach model (pure, deterministic — no ML, no network) */
/*                                                                     */
/*  Turns the flat jobs feed into a COMPANY-LEVEL outreach list for a   */
/*  college placement cell: who's hiring designers in India, how to     */
/*  reach them (pattern + posted contacts), and a hiring-intent score   */
/*  so the team can prioritise. Everything here is computed from the    */
/*  feed at build/request time; there are no runtime calls of any kind. */
/* ------------------------------------------------------------------ */

export interface CompanyOutreach {
  /** Same slug as the company directory (links to /companies/[slug]). */
  slug: string;
  /** Display name (most-frequent spelling from buildCompanies). */
  name: string;
  /** First non-null logo URL across the company's roles (or null). */
  logo: string | null;
  /** Best-effort web domain ("acme.com"), or null when undecidable. */
  domain: string | null;
  /** Number of live roles in the current feed. */
  openRoles: number;
  /** Distinct disciplines this company hires across. */
  disciplines: Discipline[];
  /** Distinct non-blank location strings seen for this company. */
  locations: string[];
  /** A representative role title (the newest role's title). */
  topRole: string;
  /** Primary city label ("Bengaluru" / "Remote" / "Multiple" / "—"). */
  city: string;
  /** Whether this is one of the curated top companies. */
  isTop: boolean;
  /** Hiring-intent score, 0–100 (see `scoreCompany` for the formula). */
  score: number;
  /** Short human-readable reasons backing the score (for the tooltip). */
  scoreReasons: string[];
  /**
   * Pattern (guessed) company mailboxes — only when a domain is known.
   * These are common conventions, NOT verified addresses; the UI says so.
   */
  emails: {
    careers: string;
    hr: string;
    talent: string;
    recruiting: string;
    jobs: string;
  } | null;
  /** `https://<domain>/careers` when a domain is known, else null. */
  careersUrl: string | null;
  /** `https://<domain>` when a domain is known, else null. */
  websiteUrl: string | null;
  /** Reliable LinkedIn *company* search URL (never a guessed vanity slug). */
  linkedinCompanySearch: string;
  /** LinkedIn *people* search for this company's TA / recruiters / HR. */
  linkedinTaSearch: string;
  /** Recruiter emails the COMPANY itself published in its job posts. */
  postedEmails: string[];
  /** Phone / WhatsApp numbers the company published in its job posts. */
  postedPhones: string[];
  /** One-line personalization hook for the outreach email. */
  personalization: string;
}

/* ------------------------------------------------------------------ */
/*  Domain / email derivation                                          */
/* ------------------------------------------------------------------ */

/**
 * Hostnames that are logo/asset CDNs or job-board domains — a logo served from
 * one of these tells us nothing about the *employer's* own web domain, so we
 * never derive an email/website domain from them. (We still fall back to the
 * name-based `guessDomain` for these.)
 */
const ASSET_OR_BOARD_HOSTS = [
  "googleusercontent.com",
  "gstatic.com",
  "ggpht.com",
  "licdn.com",
  "media.licdn.com",
  "cloudfront.net",
  "amazonaws.com",
  "s3.amazonaws.com",
  "cloudinary.com",
  "imgix.net",
  "fastly.net",
  "akamaized.net",
  "unsplash.com",
  "gravatar.com",
  "wp.com",
  "wordpress.com",
  "githubusercontent.com",
  "logo.clearbit.com",
  "clearbit.com",
  "ashbyhq.com",
  "greenhouse.io",
  "lever.co",
  "remoteok.com",
  "remoteok.io",
  "internshala.com",
  "internshala-uploads.s3.amazonaws.com",
  "foundit.in",
  "shine.com",
  "apna.co",
  "unstop.com",
  "behance.net",
  "dribbble.com",
  "freshersworld.com",
  "t.me",
  "telegram.org",
];

/**
 * Job-board / platform email domains. Addresses on these are the *platform's*
 * (apply-relay, notifications), never the employer's — so we drop them from
 * the company's "posted emails". Matched as a domain suffix.
 */
const PLATFORM_EMAIL_DOMAINS = [
  "internshala.com",
  "foundit.in",
  "shine.com",
  "apna.co",
  "unstop.com",
  "behance.net",
  "dribbble.com",
  "freshersworld.com",
  "linkedin.com",
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "remoteok.com",
  "remoteok.io",
  "telegram.org",
  "example.com",
  "email.com",
  "domain.com",
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.in",
  "outlook.com",
  "hotmail.com",
  "rediffmail.com",
  "protonmail.com",
  "icloud.com",
];

/** Strip a leading "www." and lowercase a hostname. */
function cleanHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/**
 * Try to read the employer's web domain from a direct logo URL. Returns null
 * unless the logo is served from the company's *own* host (i.e. not an asset
 * CDN or job board). This catches cases like a logo at `https://acme.com/...`.
 */
function domainFromLogo(logo: string | null): string | null {
  if (!logo) return null;
  let host: string;
  try {
    host = new URL(logo).hostname;
  } catch {
    return null;
  }
  const clean = cleanHost(host);
  if (!clean.includes(".")) return null;
  if (ASSET_OR_BOARD_HOSTS.some((h) => clean === h || clean.endsWith(`.${h}`))) {
    return null;
  }
  return clean;
}

/**
 * Best-effort employer web domain: prefer a domain read off the company's own
 * logo host, else the name-based heuristic (`guessDomain`). The brief's
 * `guessDomain(company, logo)` shape is realised here — `guessDomain` itself is
 * name-only, so we layer the logo signal on top. Returns null when undecidable.
 */
export function outreachDomain(
  company: string | null | undefined,
  logo: string | null
): string | null {
  return domainFromLogo(logo) ?? guessDomain(company ?? null);
}

/** Whether an email's domain is a known platform / freemail address. */
function isPlatformEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const dom = email.slice(at + 1).toLowerCase();
  return PLATFORM_EMAIL_DOMAINS.some(
    (d) => dom === d || dom.endsWith(`.${d}`)
  );
}

/* ------------------------------------------------------------------ */
/*  Posted-contact extraction (regex over description + contact text)  */
/* ------------------------------------------------------------------ */

/** Email matcher — kept conservative; validated/filtered after capture. */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/** Indian mobile (optionally +91 prefixed). */
const PHONE_RE = /(?:\+?91[-\s]?)?[6-9]\d{9}/g;
/** wa.me / WhatsApp links. */
const WA_RE = /wa\.me\/(\d{6,15})/gi;

const MAX_POSTED = 5;

/**
 * Pull recruiter emails the company itself published, from the combined
 * description + contact text of THIS company's roles. Platform / freemail
 * domains are dropped (those are the board's relay addresses, not the
 * employer's), results are de-duped case-insensitively and capped.
 */
function extractPostedEmails(jobs: Job[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const job of jobs) {
    const hay = `${job.description ?? ""} ${job.contact ?? ""}`;
    const matches = hay.match(EMAIL_RE);
    if (!matches) continue;
    for (const raw of matches) {
      const email = raw.trim().replace(/[.,;:)\]]+$/, "").toLowerCase();
      if (!email.includes("@") || email.length > 100) continue;
      if (isPlatformEmail(email)) continue;
      if (seen.has(email)) continue;
      seen.add(email);
      out.push(email);
      if (out.length >= MAX_POSTED) return out;
    }
  }
  return out;
}

/**
 * Pull phone / WhatsApp numbers the company published, from the combined
 * description + contact text. Normalises to a display string, de-dupes by the
 * trailing 10 digits (so "+91 98…" and "98…" collapse), and caps the list.
 */
function extractPostedPhones(jobs: Job[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (display: string, digits: string) => {
    const key = digits.slice(-10);
    if (key.length < 10 || seen.has(key)) return;
    seen.add(key);
    out.push(display);
  };
  for (const job of jobs) {
    if (out.length >= MAX_POSTED) break;
    const hay = `${job.description ?? ""} ${job.contact ?? ""}`;

    for (const m of hay.matchAll(WA_RE)) {
      push(`wa.me/${m[1]}`, m[1]);
      if (out.length >= MAX_POSTED) break;
    }
    if (out.length >= MAX_POSTED) break;

    for (const m of hay.matchAll(PHONE_RE)) {
      const digits = m[0].replace(/[^\d]/g, "");
      // 10-digit local, or 12-digit (91 + 10). Anything else is noise.
      if (digits.length !== 10 && !(digits.length === 12 && digits.startsWith("91"))) {
        continue;
      }
      push(m[0].trim(), digits);
      if (out.length >= MAX_POSTED) break;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Hiring-intent score (0–100, deterministic)                         */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hiring-intent score in [0, 100], higher = a hotter, more reachable target.
 * Pure and deterministic given a fixed clock. The formula (documented so the
 * placement team can trust the ranking):
 *
 *   volume   (max 55): log-scaled open roles — `round(55 * ln(1+n) / ln(1+25))`,
 *                       capped at 55 (≈25 roles saturates). Biggest weight: more
 *                       openings ⇒ more reason to recruit there.
 *   recency  (max 22): a role posted within 7d → +22; else within 14d → +11;
 *                       else 0. Fresh demand is the strongest "act now" signal.
 *   reputation(max 14): reputationTier(name) × 7 → elite 14, top 7, else 0.
 *   directEmail (+6) : the company published a real (non-platform) recruiter
 *                       email — a warm, individual channel exists.
 *   salary      (+3) : at least one role discloses pay (a serious, complete post).
 *
 * Sum is clamped to 100. `now` is injectable for deterministic tests.
 */
export function scoreCompany(
  args: {
    openRoles: number;
    latestTime: number;
    hasRecentRole7d: boolean;
    hasRecentRole14d: boolean;
    repTier: number;
    hasDirectEmail: boolean;
    hasSalary: boolean;
  }
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  const n = Math.max(0, args.openRoles);
  const volume = Math.min(55, Math.round((55 * Math.log(1 + n)) / Math.log(1 + 25)));

  let recency = 0;
  if (args.hasRecentRole7d) {
    recency = 22;
    reasons.push("posted this week");
  } else if (args.hasRecentRole14d) {
    recency = 11;
    reasons.push("posted in last 2 weeks");
  }

  const reputation = args.repTier * 7;
  if (args.repTier >= 2) reasons.push("elite company");
  else if (args.repTier === 1) reasons.push("top company");

  const directEmail = args.hasDirectEmail ? 6 : 0;
  if (args.hasDirectEmail) reasons.push("direct email");

  const salary = args.hasSalary ? 3 : 0;
  if (args.hasSalary) reasons.push("discloses pay");

  // Roles reason first (most informative), built from the count.
  reasons.unshift(`${n} open ${n === 1 ? "role" : "roles"}`);

  const score = Math.min(
    100,
    volume + recency + reputation + directEmail + salary
  );
  return { score, reasons };
}

/* ------------------------------------------------------------------ */
/*  City + personalization helpers                                     */
/* ------------------------------------------------------------------ */

/**
 * Primary city label for a company from its roles' location buckets:
 *   - one concrete city across all roles → that city's label,
 *   - several concrete cities → "Multiple",
 *   - only remote roles → "Remote",
 *   - nothing recognisable → "—".
 */
function primaryCity(jobs: Job[]): string {
  const cities = new Set<string>();
  let sawRemote = false;
  for (const job of jobs) {
    const key = locationKey(job);
    if (key === "remote") {
      sawRemote = true;
    } else if (key !== "other") {
      cities.add(LOCATION_LABELS[key]);
    }
  }
  if (cities.size === 1) return [...cities][0];
  if (cities.size > 1) return "Multiple";
  if (sawRemote) return "Remote";
  return "—";
}

/** Short, comma-joined discipline labels (e.g. "UI/UX & Product"). */
function disciplineLabels(disciplines: Discipline[]): string {
  const labels = disciplines.map((d) => DISCIPLINE_MAP[d].label);
  if (labels.length === 0) return "design";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}

/* ------------------------------------------------------------------ */
/*  buildOutreach — the public entry point                             */
/* ------------------------------------------------------------------ */

/**
 * Build the company-level outreach list from the flat jobs feed. Grouping,
 * names, slugs, logos, disciplines and locations come straight from
 * `buildCompanies` (so identities match the company directory exactly); we then
 * layer domain/email derivation, posted-contact extraction, the hiring-intent
 * score and a personalization line on top.
 *
 * Returned sorted by score desc, then openRoles desc, then name A–Z. `now` is
 * injectable for deterministic tests.
 */
export function buildOutreach(
  jobs: Job[],
  now: number = Date.now()
): CompanyOutreach[] {
  const companies = buildCompanies(jobs);

  // Index roles by the same normalized key buildCompanies groups on, so we can
  // attach each company's own jobs for posted-contact + recency derivation.
  const byKey = new Map<string, Job[]>();
  for (const job of jobs) {
    const original = job.company?.trim();
    if (!original) continue;
    const key = normalizeCompany(original) || original.toLowerCase();
    if (!key) continue;
    const arr = byKey.get(key);
    if (arr) arr.push(job);
    else byKey.set(key, [job]);
  }

  const out: CompanyOutreach[] = companies.map((c: CompanySummary) => {
    const key = normalizeCompany(c.name) || c.name.toLowerCase();
    const companyJobs = byKey.get(key) ?? [];

    const domain = outreachDomain(c.name, c.logo);
    const emails = domain
      ? {
          careers: `careers@${domain}`,
          hr: `hr@${domain}`,
          talent: `talent@${domain}`,
          recruiting: `recruiting@${domain}`,
          jobs: `jobs@${domain}`,
        }
      : null;

    const postedEmails = extractPostedEmails(companyJobs);
    const postedPhones = extractPostedPhones(companyJobs);

    // Recency + salary signals from this company's own roles.
    let hasRecent7d = false;
    let hasRecent14d = false;
    let hasSalary = false;
    let latestTime = 0;
    let newestTitle = "";
    for (const job of companyJobs) {
      const t = effectiveTime(job);
      if (t > latestTime) {
        latestTime = t;
        newestTitle = job.title?.trim() || newestTitle;
      }
      if (t > 0) {
        const age = now - t;
        if (age >= 0 && age <= 7 * DAY_MS) hasRecent7d = true;
        else if (age >= 0 && age <= 14 * DAY_MS) hasRecent14d = true;
      }
      if (job.salary && job.salary.trim()) hasSalary = true;
    }
    // 7d implies 14d for the scorer's "within 2 weeks" tier.
    if (hasRecent7d) hasRecent14d = true;

    const { score, reasons } = scoreCompany({
      openRoles: c.count,
      latestTime,
      hasRecentRole7d: hasRecent7d,
      hasRecentRole14d: hasRecent14d,
      repTier: reputationTier(c.name),
      hasDirectEmail: postedEmails.length > 0,
      hasSalary,
    });

    const city = primaryCity(companyJobs);
    const enc = encodeURIComponent(c.name);
    const linkedinCompanySearch = `https://www.linkedin.com/search/results/companies/?keywords=${enc}`;
    const linkedinTaSearch = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
      `${c.name} (talent acquisition OR recruiter OR HR)`
    )}`;

    const roleWord = c.count === 1 ? "role" : "roles";
    const where = city && city !== "—" && city !== "Multiple" ? ` in ${city}` : "";
    const personalization = `you're currently hiring ${c.count} ${disciplineLabels(
      c.disciplines
    )} design ${roleWord}${where}`;

    return {
      slug: c.slug,
      name: c.name,
      logo: c.logo,
      domain,
      openRoles: c.count,
      disciplines: c.disciplines,
      locations: c.locations,
      topRole: newestTitle || c.name,
      city,
      isTop: c.isTop,
      score,
      scoreReasons: reasons,
      emails,
      careersUrl: domain ? `https://${domain}/careers` : null,
      websiteUrl: domain ? `https://${domain}` : null,
      linkedinCompanySearch,
      linkedinTaSearch,
      postedEmails,
      postedPhones,
      personalization,
    } satisfies CompanyOutreach;
  });

  out.sort(
    (a, b) =>
      b.score - a.score ||
      b.openRoles - a.openRoles ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  );

  return out;
}

/* ------------------------------------------------------------------ */
/*  CSV export                                                         */
/* ------------------------------------------------------------------ */

/** Column order for the outreach CSV (header row + `outreachToCsvRow`). */
export const OUTREACH_CSV_COLUMNS = [
  "company",
  "domain",
  "careers_email",
  "hr_email",
  "talent_email",
  "careers_url",
  "website_url",
  "linkedin_company_search",
  "linkedin_ta_search",
  "posted_emails",
  "posted_phones",
  "open_roles",
  "disciplines",
  "locations",
  "score",
  "score_reasons",
  "personalization",
  "draft_email",
] as const;

/** RFC-4180 quote: wrap in double-quotes, doubling any embedded quotes. */
function csvQuote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * One CSV data row (in `OUTREACH_CSV_COLUMNS` order) for a company. Multi-value
 * fields are " | "-joined; `draftEmail` is the full template body with newlines
 * preserved (RFC-4180 allows literal newlines inside a quoted field, and Excel
 * / Sheets honour them). All fields are quoted + escaped.
 */
export function outreachToCsvRow(c: CompanyOutreach, draftEmail: string): string {
  const cells = [
    c.name,
    c.domain ?? "",
    c.emails?.careers ?? "",
    c.emails?.hr ?? "",
    c.emails?.talent ?? "",
    c.careersUrl ?? "",
    c.websiteUrl ?? "",
    c.linkedinCompanySearch,
    c.linkedinTaSearch,
    c.postedEmails.join(" | "),
    c.postedPhones.join(" | "),
    String(c.openRoles),
    c.disciplines.map((d) => DISCIPLINE_MAP[d].label).join(" | "),
    c.locations.join(" | "),
    String(c.score),
    c.scoreReasons.join(" | "),
    c.personalization,
    draftEmail,
  ];
  return cells.map((v) => csvQuote(v ?? "")).join(",");
}

/**
 * Build the full CSV document (header + one row per company). `draftFor`
 * supplies the per-company draft-email body (so the CSV builder stays decoupled
 * from the template module). Prefixed with a UTF-8 BOM so Excel reads ₹ / accents
 * correctly. Lines are CRLF-joined per RFC-4180.
 */
export function buildOutreachCsv(
  rows: CompanyOutreach[],
  draftFor: (c: CompanyOutreach) => string
): string {
  const header = OUTREACH_CSV_COLUMNS.map((h) => csvQuote(h)).join(",");
  const body = rows.map((c) => outreachToCsvRow(c, draftFor(c)));
  return `﻿${[header, ...body].join("\r\n")}\r\n`;
}
