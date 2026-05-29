import type { Metadata } from "next";
import { CompanyDirectory } from "@/components/CompanyDirectory";
import { PageNav } from "@/components/PageNav";
import { buildCompanies } from "@/lib/companies";
import { loadAllJobs } from "@/lib/jobs-data";
import { ogImageUrl } from "@/lib/og";

const OG_IMAGE = ogImageUrl({
  kind: "site",
  title: "Companies hiring designers in India",
  subtitle: "Deduped by company, with open-role counts",
  tag: "India design jobs",
});

/**
 * Company directory (server, SSG) — every company hiring on DOD, deduped to a
 * canonical identity, as a responsive grid of cards with a client search/sort
 * island. Fully crawlable: the list is computed server-side from the feed and
 * rendered into the HTML; the island only re-orders/filters what's already
 * there.
 */

export const metadata: Metadata = {
  // `absolute` so the root layout's "%s · DOD" template doesn't double the suffix.
  title: { absolute: "Companies hiring designers in India · DOD" },
  description:
    "Browse every company hiring designers in India on DOD — UI/UX, Product, Communication and Industrial design roles, deduped by company with open-role counts. Find where to apply.",
  alternates: { canonical: "/companies" },
  openGraph: {
    type: "website",
    title: "Companies hiring designers in India · DOD",
    description:
      "Browse every company hiring designers in India on DOD — deduped by company with open-role counts across UI/UX, Product, Communication and Industrial design.",
    url: "/companies",
    siteName: "DOD",
    locale: "en_IN",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Companies hiring designers in India · DOD",
    description:
      "Every company hiring designers in India, deduped with open-role counts — on DOD.",
    images: [OG_IMAGE],
  },
};

export default async function CompaniesPage() {
  const jobs = await loadAllJobs();
  const companies = buildCompanies(jobs);
  const topCount = companies.filter((c) => c.isTop).length;

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <PageNav current="companies" />

        <div className="mt-8">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Companies hiring designers in India
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60 sm:text-base">
            {companies.length.toLocaleString("en-IN")} companies with live design
            roles
            {topCount > 0
              ? `, including ${topCount.toLocaleString("en-IN")} top companies`
              : ""}
            . Pick a company to see all its openings.
          </p>
        </div>

        <CompanyDirectory companies={companies} />
      </div>
    </main>
  );
}
