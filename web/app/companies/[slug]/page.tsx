import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { DisciplineBadge } from "@/components/DisciplineBadge";
import { PageNav } from "@/components/PageNav";
import { ArrowUpRightIcon, PinIcon } from "@/components/icons";
import { SalaryChip, TopBadge } from "@/components/tracker-ui";
import { buildCompanies, getCompanyBySlug } from "@/lib/companies";
import { jobSlug, postedAgo, sourceLabel } from "@/lib/jobs";
import { loadAllJobs } from "@/lib/jobs-data";
import type { Discipline } from "@/lib/types";

/**
 * Per-company page (server, SSG) — a crawlable hub for every role at one
 * company. Mirrors the `/jobs/[id]` pattern: `generateStaticParams` lists every
 * company slug, `generateMetadata` builds per-company SEO, and unknown slugs
 * 404 via `notFound()`. Slugs are route-safe (`companySlug`: lowercase
 * [a-z0-9-]); no segment is ever percent-encoded.
 */

export const dynamicParams = true;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const jobs = await loadAllJobs();
  return buildCompanies(jobs).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const jobs = await loadAllJobs();
  const company = getCompanyBySlug(slug, jobs);
  if (!company) return { title: "Company not found" };

  const roles = company.count;
  const titleText = `${company.name} — design jobs & openings · DOD`;
  const description = `${company.name} has ${roles} live design ${
    roles === 1 ? "role" : "roles"
  } on DOD${
    company.locations[0] ? ` in ${company.locations[0]}` : ""
  }. Browse openings across ${company.disciplines.length} design ${
    company.disciplines.length === 1 ? "discipline" : "disciplines"
  } and apply.`;
  const canonical = `/companies/${company.slug}`;

  return {
    // `absolute` so the root layout's "%s · DOD" template doesn't double the suffix.
    title: { absolute: titleText },
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: titleText,
      description,
      url: canonical,
      siteName: "DOD",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: titleText,
      description,
    },
  };
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const jobs = await loadAllJobs();
  const company = getCompanyBySlug(slug, jobs);
  if (!company) notFound();

  const { name, count, disciplines, locations, logo, isTop } = company;
  const headDiscipline: Discipline = disciplines[0] ?? "uiux";

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <PageNav current="companies" />

        {/* back link */}
        <Link
          href="/companies"
          className="group mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-white/55 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:rounded"
        >
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:-translate-x-0.5"
          >
            ←
          </span>
          All companies
        </Link>

        {/* header */}
        <section className="dod-glass dod-glass--silver relative mt-4 overflow-hidden rounded-3xl p-6 sm:p-8">
          {isTop && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400"
            />
          )}
          <div className="flex items-start gap-4">
            <CompanyAvatar
              company={name}
              logo={logo}
              discipline={headDiscipline}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {isTop && <TopBadge name={name} />}
                <span className="inline-flex items-center rounded-full border border-[var(--silver-line)] bg-white/[0.05] px-2.5 py-1 text-xs font-medium tabular-nums text-white/65">
                  {count.toLocaleString("en-IN")}{" "}
                  {count === 1 ? "open role" : "open roles"}
                </span>
              </div>
              <h1 className="mt-2 text-balance text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl">
                {name}
              </h1>
              {disciplines.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {disciplines.map((d) => (
                    <DisciplineBadge key={d} discipline={d} />
                  ))}
                </div>
              )}
              {locations.length > 0 && (
                <p className="mt-3 flex items-start gap-1.5 text-sm text-white/55">
                  <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                  <span>{locations.slice(0, 6).join(" · ")}</span>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* roles */}
        <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-white/45">
          Open roles
        </h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {company.jobs.map((job) => {
            const salary = job.salary?.trim();
            return (
              <li key={job.id}>
                <div
                  className={clsx(
                    "dod-glass dod-glass--silver group flex flex-col gap-3 rounded-2xl p-4 transition-colors duration-200 hover:bg-white/[0.08]",
                    "sm:flex-row sm:items-center sm:justify-between"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <DisciplineBadge discipline={job.discipline} />
                      {salary && <SalaryChip salary={salary} />}
                    </div>
                    <Link
                      href={`/jobs/${jobSlug(job.id)}`}
                      className="mt-2 block text-balance text-base font-semibold leading-snug tracking-tight text-white transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
                    >
                      {job.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/55">
                      {job.location && (
                        <>
                          <span className="inline-flex items-center gap-1">
                            <PinIcon className="h-3.5 w-3.5 text-white/40" />
                            {job.location}
                          </span>
                          <span className="text-white/30" aria-hidden="true">
                            ·
                          </span>
                        </>
                      )}
                      <span>{sourceLabel(job.source)}</span>
                      <span className="text-white/30" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-white/45">{postedAgo(job)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/jobs/${jobSlug(job.id)}`}
                      className={clsx(
                        "inline-flex items-center justify-center gap-1 rounded-xl border border-[var(--silver-line)] bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/70",
                        "transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]"
                      )}
                    >
                      Details
                    </Link>
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={clsx(
                        "inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white",
                        "transition-all duration-200 hover:bg-white/[0.12]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]"
                      )}
                      aria-label={`Apply to ${job.title} at ${name} (opens in a new tab)`}
                    >
                      Apply
                      <ArrowUpRightIcon className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
