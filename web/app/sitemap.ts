import type { MetadataRoute } from "next";
import { buildCompanies } from "@/lib/companies";
import { jobSlug } from "@/lib/jobs";
import { loadAllJobs } from "@/lib/jobs-data";

const BASE_URL = "https://dodlovestowork.vercel.app";

/**
 * Sitemap — the board home, the Companies + Insights hubs, one entry per
 * company, and one entry per job. Job URLs use the colon-free `jobSlug`
 * (":" → "~"); company URLs use the route-safe `companySlug` — both matching
 * the statically-generated segments and the in-app hrefs. `lastModified` uses
 * the role's / company's effective date when known.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await loadAllJobs();
  const companies = buildCompanies(jobs);

  const jobUrls: MetadataRoute.Sitemap = jobs.map((job) => {
    const stamp = job.posted_at ?? job.seen_at;
    const lastModified = stamp ? new Date(stamp.replace(" ", "T")) : undefined;
    return {
      url: `${BASE_URL}/jobs/${jobSlug(job.id)}`,
      lastModified:
        lastModified && !Number.isNaN(lastModified.getTime())
          ? lastModified
          : undefined,
      changeFrequency: "daily",
      priority: 0.6,
    };
  });

  const companyUrls: MetadataRoute.Sitemap = companies.map((c) => ({
    url: `${BASE_URL}/companies/${c.slug}`,
    lastModified:
      c.latestTime > 0 ? new Date(c.latestTime) : undefined,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/companies`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/insights`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...companyUrls,
    ...jobUrls,
  ];
}
