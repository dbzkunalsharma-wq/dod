import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { PageNav } from "@/components/PageNav";
import { ArrowUpRightIcon } from "@/components/icons";
import { DISCIPLINE_MAP, DISCIPLINES, sourceLabel } from "@/lib/jobs";
import { loadAllJobs, loadStatsHistory } from "@/lib/jobs-data";
import {
  computeInsights,
  computeSourceHealth,
  formatPay,
  SALARY_MIN_SAMPLE,
  type SalarySlice,
} from "@/lib/insights";
import { ogImageUrl } from "@/lib/og";

const OG_IMAGE = ogImageUrl({
  kind: "site",
  title: "India design hiring insights",
  subtitle: "Trending companies · disciplines · cities · pay",
  tag: "India design jobs",
});

/**
 * Insights (server, SSG) — a deterministic analytics snapshot of India design
 * hiring: headline stat cards, trending companies, source health (from the
 * daily stats-history snapshots), discipline mix, top cities, and salary
 * coverage. All numbers are computed at build time from the feed + history; no
 * client fetch, no ML.
 */

export const metadata: Metadata = {
  // `absolute` so the root layout's "%s · DOD" template doesn't double the suffix.
  title: { absolute: "Insights — India design hiring · DOD" },
  description:
    "A live snapshot of design hiring in India: total roles, what's new this week, trending companies, source health, discipline mix, top cities and salary transparency — from DOD's aggregated feed.",
  alternates: { canonical: "/insights" },
  openGraph: {
    type: "website",
    title: "Insights — India design hiring · DOD",
    description:
      "Trends in India design hiring: trending companies, source health, discipline mix, top cities and salary coverage — from DOD.",
    url: "/insights",
    siteName: "DOD",
    locale: "en_IN",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Insights — India design hiring · DOD",
    description:
      "Trends in India design hiring — trending companies, source health, discipline mix and more.",
    images: [OG_IMAGE],
  },
};

/** "29 May" style short date from a "YYYY-MM-DD" snapshot date. */
function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default async function InsightsPage() {
  const [jobs, history] = await Promise.all([
    loadAllJobs(),
    loadStatsHistory(),
  ]);
  const insights = computeInsights(jobs);
  const health = computeSourceHealth(history);
  const { salary } = insights;

  const stats = [
    { label: "Total roles", value: insights.total },
    { label: "New this week", value: insights.newThisWeek },
    { label: "Companies hiring", value: insights.companies },
    { label: "Sources live", value: insights.sourcesLive },
  ];

  const maxDiscipline = Math.max(
    1,
    ...insights.perDiscipline.map((d) => d.count)
  );
  const maxCity = Math.max(1, ...insights.topCities.map((c) => c.count));

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <PageNav current="insights" />

        <div className="mt-8">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            India design hiring — insights
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60 sm:text-base">
            A deterministic snapshot from DOD&rsquo;s aggregated feed across{" "}
            {insights.sourcesLive} live{" "}
            {insights.sourcesLive === 1 ? "source" : "sources"}.
          </p>
        </div>

        {/* headline stat cards */}
        <section
          aria-label="Headline stats"
          className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="dod-glass dod-glass--silver rounded-2xl p-4 sm:p-5"
            >
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-white sm:text-3xl">
                {s.value.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-white/45">
                {s.label}
              </p>
            </div>
          ))}
        </section>

        {/* trending companies */}
        {insights.trendingCompanies.length > 0 && (
          <section aria-labelledby="trending-h" className="mt-8">
            <h2
              id="trending-h"
              className="text-sm font-medium uppercase tracking-wide text-white/45"
            >
              Trending companies
            </h2>
            <p className="mt-1 text-xs text-white/45">
              Most new roles in the last 14 days.
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {insights.trendingCompanies.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/companies/${c.slug}`}
                    className={clsx(
                      "dod-glass dod-glass--silver group flex items-center gap-3 rounded-2xl p-3.5 transition-all duration-200",
                      "hover:-translate-y-0.5 hover:bg-white/[0.09]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]"
                    )}
                  >
                    <CompanyAvatar
                      company={c.name}
                      logo={c.logo}
                      discipline="uiux"
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {c.name}
                      </p>
                      <p className="text-xs tabular-nums text-white/55">
                        {c.totalCount} {c.totalCount === 1 ? "role" : "roles"}
                        <span className="text-emerald-300/90">
                          {" "}
                          · {c.recentCount} new in 14d
                        </span>
                      </p>
                    </div>
                    <ArrowUpRightIcon className="h-4 w-4 shrink-0 text-white/35 transition-colors group-hover:text-white/70" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* source health */}
        <section aria-labelledby="source-h" className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="source-h"
              className="text-sm font-medium uppercase tracking-wide text-white/45"
            >
              Source health
            </h2>
            {health.latestDate && (
              <span className="text-xs text-white/40">
                Latest run {shortDate(health.latestDate)}
              </span>
            )}
          </div>
          <div className="dod-glass dod-glass--silver mt-3 rounded-2xl p-4 sm:p-5">
            <ul className="flex flex-col gap-3.5">
              {health.rows.map((row) => {
                const pct = Math.round((row.count / health.max) * 100);
                return (
                  <li key={row.source}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white/80">
                          {sourceLabel(row.source)}
                        </span>
                        {row.noResults && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/30">
                            <span aria-hidden="true">⚠️</span>
                            no results in latest run
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="font-semibold text-white">
                          {row.count.toLocaleString("en-IN")}
                        </span>
                        {row.delta !== null && row.delta !== 0 && (
                          <span
                            className={clsx(
                              "text-xs",
                              row.delta > 0
                                ? "text-emerald-300/90"
                                : "text-rose-300/90"
                            )}
                            title={`Change since ${
                              health.earliestDate
                                ? shortDate(health.earliestDate)
                                : "first snapshot"
                            }`}
                          >
                            {row.delta > 0 ? "↑" : "↓"}{" "}
                            {Math.abs(row.delta).toLocaleString("en-IN")}
                            {health.earliestDate
                              ? ` since ${shortDate(health.earliestDate)}`
                              : ""}
                          </span>
                        )}
                        {!health.hasTrend && health.latestDate && (
                          <span className="text-xs text-white/40">
                            tracking since {shortDate(health.latestDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* proportional bar */}
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400/80 to-indigo-400/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* two-column: disciplines + cities/salary */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* disciplines */}
          <section aria-labelledby="disc-h">
            <h2
              id="disc-h"
              className="text-sm font-medium uppercase tracking-wide text-white/45"
            >
              Disciplines
            </h2>
            <div className="dod-glass dod-glass--silver mt-3 rounded-2xl p-4 sm:p-5">
              <ul className="flex flex-col gap-3.5">
                {insights.perDiscipline.map((d) => {
                  const meta = DISCIPLINE_MAP[d.discipline];
                  const pct = Math.round((d.count / maxDiscipline) * 100);
                  return (
                    <li key={d.discipline}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-1.5 font-medium text-white/80">
                          <span
                            className={clsx(
                              "h-2 w-2 rounded-full",
                              meta.dot
                            )}
                          />
                          {d.label}
                        </span>
                        <span className="font-semibold tabular-nums text-white">
                          {d.count.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className={clsx("h-full rounded-full", meta.topLine)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* cities + salary */}
          <section aria-labelledby="cities-h">
            <h2
              id="cities-h"
              className="text-sm font-medium uppercase tracking-wide text-white/45"
            >
              Top cities
            </h2>
            <div className="dod-glass dod-glass--silver mt-3 rounded-2xl p-4 sm:p-5">
              {insights.topCities.length > 0 ? (
                <ul className="flex flex-col gap-3.5">
                  {insights.topCities.map((c) => {
                    const pct = Math.round((c.count / maxCity) * 100);
                    return (
                      <li key={c.key}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-white/80">
                            {c.label}
                          </span>
                          <span className="font-semibold tabular-nums text-white">
                            {c.count.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-400/80 to-teal-400/80"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-white/50">
                  No city data available yet.
                </p>
              )}
            </div>

            {/* salary coverage */}
            <h2 className="mt-6 text-sm font-medium uppercase tracking-wide text-white/45">
              Salary transparency
            </h2>
            <div className="dod-glass dod-glass--silver mt-3 rounded-2xl p-4 sm:p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-white/60">
                  Roles listing a salary
                </p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-white">
                  {insights.salaryCoveragePct}%
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400/85 to-teal-400/85"
                  style={{ width: `${insights.salaryCoveragePct}%` }}
                />
              </div>
            </div>
          </section>
        </div>

        {/* ---- Salary (honest, directional) ------------------------------- */}
        {salary.count >= SALARY_MIN_SAMPLE && !salary.overall.na && (
          <section aria-labelledby="salary-h" className="mt-8">
            <h2
              id="salary-h"
              className="text-sm font-medium uppercase tracking-wide text-white/45"
            >
              Pay snapshot
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-white/45">
              Based on the {salary.count.toLocaleString("en-IN")} roles (~
              {salary.coveragePct}%) that disclose pay — directional, not
              exhaustive. India design listings rarely post salaries, and those
              that do are mostly internships and junior roles, so figures are
              shown per month (full-time annual salaries are seldom listed).
            </p>

            {/* overall median + range */}
            <div className="dod-glass dod-glass--silver mt-3 rounded-2xl p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-white/45">
                    Median monthly pay
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-white sm:text-4xl">
                    {formatPay(salary.overall.median)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/45">
                    Typical range (p25–p75)
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-white/85">
                    {formatPay(salary.overall.p25)}
                    <span className="px-1.5 text-white/40">–</span>
                    {formatPay(salary.overall.p75)}
                  </p>
                </div>
              </div>
            </div>

            {/* breakdowns: discipline / experience / cities */}
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <SalaryBreakdown
                title="By discipline"
                slices={salary.byDiscipline}
                dots={DISCIPLINES.map((d) => d.dot)}
              />
              <SalaryBreakdown
                title="By experience"
                slices={salary.byExperience}
              />
              <SalaryBreakdown
                title="By city"
                slices={salary.byCity}
                emptyHint="Not enough disclosed pay by city yet."
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Salary breakdown card — compact median bars per slice              */
/*  Hides "n/a" slices (count < SALARY_MIN_SAMPLE) per the brief; bars  */
/*  scale to the largest median among the shown slices so they compare */
/*  within the group. Optional per-row `dots` tint the discipline card. */
/* ------------------------------------------------------------------ */

function SalaryBreakdown({
  title,
  slices,
  dots,
  emptyHint = "Not enough disclosed pay yet.",
}: {
  title: string;
  slices: SalarySlice[];
  /** Optional Tailwind bg-* dot classes, index-aligned to `slices`. */
  dots?: string[];
  emptyHint?: string;
}) {
  const shown = slices
    .map((slice, i) => ({ slice, dot: dots?.[i] }))
    .filter(({ slice }) => !slice.na);
  const maxMedian = Math.max(1, ...shown.map(({ slice }) => slice.median));

  return (
    <section aria-label={title}>
      <h3 className="text-xs font-medium uppercase tracking-wide text-white/45">
        {title}
      </h3>
      <div className="dod-glass dod-glass--silver mt-3 rounded-2xl p-4 sm:p-5">
        {shown.length > 0 ? (
          <ul className="flex flex-col gap-3.5">
            {shown.map(({ slice, dot }) => {
              const pct = Math.round((slice.median / maxMedian) * 100);
              return (
                <li key={slice.label}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium text-white/80">
                      {dot && (
                        <span
                          className={clsx("h-2 w-2 shrink-0 rounded-full", dot)}
                        />
                      )}
                      {slice.label}
                      <span className="tabular-nums text-white/40">
                        ({slice.count})
                      </span>
                    </span>
                    <span
                      className="font-semibold tabular-nums text-white"
                      title={`p25 ${formatPay(slice.p25)} · p75 ${formatPay(
                        slice.p75
                      )}`}
                    >
                      {formatPay(slice.median)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400/80 to-teal-400/80"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-white/50">{emptyHint}</p>
        )}
      </div>
    </section>
  );
}
