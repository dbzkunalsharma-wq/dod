import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { DisciplineBadge } from "@/components/DisciplineBadge";
import { ArrowUpRightIcon, PinIcon } from "@/components/icons";
import { SalaryChip, TopBadge } from "@/components/tracker-ui";
import {
  DISCIPLINE_MAP,
  EXPERIENCE_LABELS,
  experienceLevel,
  jobSlug,
  postedAgo,
  sourceLabel,
  topCompanyName,
} from "@/lib/jobs";
import { getJobBySlug, loadAllJobs } from "@/lib/jobs-data";
import type { Job } from "@/lib/types";

/**
 * Per-job detail page (server component) — the SEO-friendly, crawlable,
 * statically-generated counterpart to the board's quick-view modal. Reuses the
 * glass theme + the same building blocks (avatar, discipline badge, salary
 * chip, Top badge) so it reads as part of the same product.
 *
 * Job ids contain a colon ("linkedin:12345"); we route on a colon-free slug
 * (`jobSlug`, ":" → "~") so the URL needs no percent-encoding and the segment is
 * a legal filename on every OS. Every job is pre-listed by `generateStaticParams`,
 * and unknown slugs 404 via `notFound()`.
 */

// Keep dynamicParams enabled (the default): every known job is prerendered via
// generateStaticParams; any unknown slug renders on-demand and the page calls
// notFound(), so stale/removed ids still 404 cleanly.
export const dynamicParams = true;

type Params = { id: string };

export async function generateStaticParams(): Promise<Params[]> {
  const jobs = await loadAllJobs();
  // Route on a colon-free slug (jobSlug: ":" → "~"). A raw colon is an illegal
  // filename char on Windows (breaks the build) and percent-encodes in URLs (so
  // the request never matches the prerendered segment → 404). "~" is unreserved:
  // never encoded, legal on every OS. Hrefs/canonical/sitemap use the same slug.
  return jobs.map((job) => ({ id: jobSlug(job.id) }));
}

/** Trim a description down to a clean ~160-char meta/OG snippet. */
function metaDescription(job: Job): string {
  const base = job.description?.trim();
  if (base) {
    const oneLine = base.replace(/\s+/g, " ").trim();
    return oneLine.length > 160 ? `${oneLine.slice(0, 157).trimEnd()}…` : oneLine;
  }
  const where = job.location ? ` in ${job.location}` : "";
  const who = job.company ? ` at ${job.company}` : "";
  return `${job.title}${who}${where}. Apply now via DOD — live India design jobs.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobBySlug(decodeURIComponent(id));
  if (!job) {
    return { title: "Role not found" };
  }

  const company = job.company?.trim();
  const title = company ? `${job.title} at ${company}` : job.title;
  const description = metaDescription(job);
  const canonical = `/jobs/${jobSlug(job.id)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: `${title} · DOD`,
      description,
      url: canonical,
      siteName: "DOD",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · DOD`,
      description,
    },
  };
}

export default async function JobPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const job = await getJobBySlug(decodeURIComponent(id));
  if (!job) notFound();

  const topName = topCompanyName(job.company);
  const salary = job.salary?.trim();
  const description = job.description?.trim();
  const exp = experienceLevel(job);
  const meta = DISCIPLINE_MAP[job.discipline];

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        {/* back link */}
        <Link
          href="/"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-white/55 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:rounded"
        >
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-x-0.5">
            ←
          </span>
          Back to all jobs
        </Link>

        <article className="dod-glass dod-glass--silver relative mt-5 overflow-hidden rounded-3xl p-6 sm:p-8">
          {/* accent top-line echoing the card */}
          <span
            aria-hidden="true"
            className={clsx(
              "pointer-events-none absolute inset-x-0 top-0 h-[3px]",
              topName
                ? "bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400"
                : meta.topLine
            )}
          />

          <div className="flex items-start gap-4">
            <CompanyAvatar
              company={job.company}
              logo={job.logo}
              discipline={job.discipline}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DisciplineBadge discipline={job.discipline} />
                {topName && <TopBadge name={topName} />}
                <span className="inline-flex items-center rounded-full border border-[var(--silver-line)] bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-white/65">
                  {EXPERIENCE_LABELS[exp]}
                </span>
              </div>
              <h1 className="mt-2 text-balance text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl">
                {job.title}
              </h1>
              {job.company && (
                <p className="mt-1 text-base font-medium text-white/75">
                  {job.company}
                </p>
              )}
            </div>
          </div>

          {/* meta row */}
          <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-white/60">
            {job.location && (
              <>
                <span className="inline-flex items-center gap-1">
                  <PinIcon className="h-4 w-4 text-white/45" />
                  {job.location}
                </span>
                <span className="text-white/25" aria-hidden="true">
                  ·
                </span>
              </>
            )}
            <span>{sourceLabel(job.source)}</span>
            <span className="text-white/25" aria-hidden="true">
              ·
            </span>
            <span className="text-white/45">{postedAgo(job)}</span>
          </div>

          {/* salary */}
          {salary && (
            <div className="mt-4">
              <SalaryChip salary={salary} />
            </div>
          )}

          {/* description */}
          <div className="mt-6 border-t border-white/10 pt-6">
            {description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75 sm:text-base">
                {description}
              </p>
            ) : (
              <p className="text-sm italic text-white/45">
                No description was provided for this role. Open the original
                posting for full details.
              </p>
            )}
          </div>

          {/* apply */}
          <div className="mt-8">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12] sm:w-auto"
              aria-label={`Apply to ${job.title}${
                job.company ? ` at ${job.company}` : ""
              } (opens in a new tab)`}
            >
              Apply on {sourceLabel(job.source)}
              <ArrowUpRightIcon className="h-4 w-4" />
            </a>
          </div>
        </article>
      </div>
    </main>
  );
}
