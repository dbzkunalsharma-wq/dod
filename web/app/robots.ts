import type { MetadataRoute } from "next";

const BASE_URL = "https://dodlovestowork.vercel.app";

/** Allow all crawlers everywhere, and point them at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
