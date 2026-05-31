import type { MetadataRoute } from "next";

const BASE_URL = "https://dodlovestowork.vercel.app";

/**
 * Allow all crawlers everywhere except the internal, unlisted placement-outreach
 * tool (`/outreach` + its CSV export), which is kept out of search engines.
 * Point crawlers at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/outreach", "/outreach.csv"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
