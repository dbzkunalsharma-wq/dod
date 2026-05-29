import type { MetadataRoute } from "next";
import { loadAllJobs } from "@/lib/jobs-data";

const BASE_URL = "https://dodlovestowork.vercel.app";

/**
 * Sitemap — the board home plus one entry per job. Job ids contain a colon
 * ("linkedin:12345") so each URL encodes the id with `encodeURIComponent`,
 * matching the statically-generated `/jobs/[id]` segments and the in-app
 * hrefs. `lastModified` uses the role's effective date when available.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await loadAllJobs();

  const jobUrls: MetadataRoute.Sitemap = jobs.map((job) => {
    const stamp = job.posted_at ?? job.seen_at;
    const lastModified = stamp ? new Date(stamp.replace(" ", "T")) : undefined;
    return {
      url: `${BASE_URL}/jobs/${encodeURIComponent(job.id)}`,
      lastModified:
        lastModified && !Number.isNaN(lastModified.getTime())
          ? lastModified
          : undefined,
      changeFrequency: "daily",
      priority: 0.6,
    };
  });

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    ...jobUrls,
  ];
}
