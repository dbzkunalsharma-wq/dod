export type Discipline = "uiux" | "product" | "communication" | "industrial";

export type Source =
  | "linkedin"
  | "unstop"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "remoteok"
  | "telegram"
  | "internshala"
  | "foundit"
  | "shine"
  | "dribbble"
  | "behance"
  | "apna"
  | "freshersworld";

export interface Job {
  id: string;
  source: Source;
  discipline: Discipline;
  title: string;
  /** May be null in the feed (e.g. some Telegram posts) — always guard. */
  company: string | null;
  /** May be null in the feed — always guard. */
  location: string | null;
  url: string;
  contact: string | null;
  posted_at: string | null;
  /** Direct company-logo URL when known; null → fall back to favicon/initials. */
  logo: string | null;
  /** Full role description (may be absent/empty in older feed rows). */
  description?: string | null;
  salary: string | null;
  seen_at: string;
}

export interface JobsFeed {
  generated_at: string;
  count: number;
  jobs: Job[];
}

/** One daily snapshot row in public/stats-history.json. */
export interface StatsSnapshot {
  /** "YYYY-MM-DD" */
  date: string;
  total: number;
  per_source: Record<string, number>;
  per_discipline: Record<string, number>;
}

/**
 * One company in the GROWING outreach ledger (public/companies-ledger.json).
 * The ledger accumulates across daily runs — a row is added the first time a
 * company is seen and updated on every later run — so it grows to thousands of
 * rows over time. `domain` is ALREADY MX-verified at ingest time (the pipeline
 * does the DNS), so the app never does build-time network I/O.
 */
export interface LedgerEntry {
  /** Display name. */
  name: string;
  /** ISO "YYYY-MM-DD" the company was first added to the ledger. */
  first_seen: string;
  /** ISO "YYYY-MM-DD" the company was last seen in the feed. */
  last_seen: string;
  /** Distinct days this company has appeared in a run. */
  days_seen: number;
  /** Roles open in the latest run. `0` ⇒ not currently hiring (dormant). */
  open_roles: number;
  /** Discipline keys this company hires across. */
  disciplines: Discipline[];
  /** Free-form location strings seen for this company. */
  locations: string[];
  /** Direct company-logo URL when known. */
  logo?: string | null;
  /** Recruiter emails the company published in posts (already platform-filtered). */
  posted_emails: string[];
  /** Phone / WhatsApp numbers the company published in posts. */
  posted_phones: string[];
  /** ALREADY-MX-VERIFIED web domain ("acme.com"), or null when none verified. */
  domain: string | null;
  /** ISO "YYYY-MM-DD" the domain was (re)verified. */
  verified_on?: string;
}

/** The outreach ledger: a JSON object keyed by an internal company key. */
export type CompanyLedger = Record<string, LedgerEntry>;
