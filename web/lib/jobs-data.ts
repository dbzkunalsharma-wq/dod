import { cache } from "react";
import { promises as fs } from "node:fs";
import path from "node:path";
import { jobSlug } from "./jobs";
import type { Job, JobsFeed } from "./types";

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
