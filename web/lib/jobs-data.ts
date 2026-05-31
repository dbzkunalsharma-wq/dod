import { cache } from "react";
import { promises as fs } from "node:fs";
import path from "node:path";
import { jobSlug } from "./jobs";
import type {
  CompanyLedger,
  Job,
  JobsFeed,
  StatsSnapshot,
} from "./types";

/**
 * Server-only loader for the jobs feed.
 *
 * The board (client) fetches `/jobs.json` over HTTP at runtime; the static
 * server surfaces (per-job pages, sitemap, metadata) instead read the SAME
 * file straight off disk at build time via `fs`, so they prerender without a
 * network round-trip. Wrapped in React's `cache()` so the file is parsed once
 * per request/build pass and shared across `generateStaticParams`,
 * `generateMetadata`, the page, and the sitemap.
 *
 * This module must never be imported into a Client Component.
 */

const JOBS_PATH = path.join(process.cwd(), "public", "jobs.json");
const STATS_HISTORY_PATH = path.join(
  process.cwd(),
  "public",
  "stats-history.json"
);
const LEDGER_PATH = path.join(
  process.cwd(),
  "public",
  "companies-ledger.json"
);

export const loadJobsFeed = cache(async (): Promise<JobsFeed> => {
  const raw = await fs.readFile(JOBS_PATH, "utf8");
  return JSON.parse(raw) as JobsFeed;
});

/** All jobs from the feed (empty array if the feed is malformed). */
export const loadAllJobs = cache(async (): Promise<Job[]> => {
  const feed = await loadJobsFeed();
  return Array.isArray(feed?.jobs) ? feed.jobs : [];
});

/** Look up a single job by its exact (decoded) id, or null if absent. */
export async function getJobById(id: string): Promise<Job | null> {
  const jobs = await loadAllJobs();
  return jobs.find((j) => j.id === id) ?? null;
}

/** Look up a single job by its URL slug (jobSlug: ":" → "~"), or null if absent. */
export async function getJobBySlug(slug: string): Promise<Job | null> {
  const jobs = await loadAllJobs();
  return jobs.find((j) => jobSlug(j.id) === slug) ?? null;
}

/**
 * The daily stats history (public/stats-history.json) — an array of snapshots,
 * one per day. Returns `[]` if the file is missing or malformed, so the
 * insights page degrades gracefully. Wrapped in `cache()` like the feed.
 */
export const loadStatsHistory = cache(async (): Promise<StatsSnapshot[]> => {
  try {
    const raw = await fs.readFile(STATS_HISTORY_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StatsSnapshot[]) : [];
  } catch {
    return [];
  }
});

/**
 * The growing company outreach ledger (public/companies-ledger.json) — a JSON
 * object keyed by an internal company key. Returns `{}` when the file is
 * missing or malformed (or not a plain object), so the outreach surfaces
 * degrade gracefully to an empty list. Wrapped in `cache()` like the feed, so
 * the (potentially large) file is read + parsed once per build/request pass and
 * shared across the page and the CSV route. Server-only — `domain`s in here are
 * already MX-verified, so no DNS is done at build time.
 */
export const loadCompanyLedger = cache(async (): Promise<CompanyLedger> => {
  try {
    const raw = await fs.readFile(LEDGER_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as CompanyLedger;
  } catch {
    return {};
  }
});
