import type { Metadata } from "next";
import { OutreachTable } from "@/components/OutreachTable";
import { PageNav } from "@/components/PageNav";
import { loadAllJobs } from "@/lib/jobs-data";
import { applyDomainVerification, buildOutreach } from "@/lib/outreach";
import { mailableDomains } from "@/lib/verify-domains";

/**
 * Placement outreach (server) — an INTERNAL, UNLISTED tool for a college
 * placement cell: every company hiring designers in India on DOD, turned into a
 * ready outreach list of company-level official contacts with a hiring-intent
 * score. Computed deterministically from the feed (`buildOutreach`); the table
 * itself is a client island.
 *
 * NOINDEX + not in the nav / sitemap, and disallowed in robots.txt — the app
 * has no auth, so this page is "security by obscurity": shareable by URL with
 * the placement team but kept out of search engines.
 */

export const metadata: Metadata = {
  title: { absolute: "Placement outreach · DOD (internal)" },
  description:
    "Internal placement-outreach list: company-level official contacts for companies hiring designers in India.",
  robots: { index: false, follow: false },
  alternates: { canonical: undefined },
};

export default async function OutreachPage() {
  const jobs = await loadAllJobs();
  const rows = buildOutreach(jobs);
  // MX-verify the guessed domains at build time, then suppress emails for any
  // that don't actually resolve / accept mail (see applyDomainVerification).
  const mailable = await mailableDomains(
    rows.map((r) => r.domain).filter(Boolean) as string[]
  );
  const companies = applyDomainVerification(rows, mailable);

  const withDomain = companies.filter((c) => c.domainVerified).length;
  const withPosted = companies.filter(
    (c) => c.postedEmails.length > 0 || c.postedPhones.length > 0
  ).length;

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <PageNav />

        <div className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Placement outreach
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--silver-line)] bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/55">
              Internal · unlisted
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-white/60 sm:text-base">
            Company-level official contacts from{" "}
            {companies.length.toLocaleString("en-IN")} companies hiring designers
            in India — ranked by hiring intent, so the placement cell can invite
            the hottest employers to recruit first.
          </p>

          {/* honest note */}
          <div className="dod-glass dod-glass--silver mt-4 rounded-2xl p-4 text-sm leading-relaxed text-white/65 sm:p-5">
            <p>
              <span className="font-medium text-white/85">How to use this:</span>{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[0.85em] text-white/85">
                careers@
              </code>{" "}
              /{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[0.85em] text-white/85">
                hr@
              </code>{" "}
              are common address patterns derived from each company&rsquo;s
              domain, now{" "}
              <span className="text-white/85">
                MX-verified — unresolved domain guesses are dropped
              </span>
              , so the addresses shown can actually receive mail. Green badges
              are recruiter emails the company itself published in a job post
              (already verified by them). For verified individual recruiter
              emails at scale, hit{" "}
              <span className="font-medium text-white/85">Copy all domains</span>{" "}
              (or download the CSV) and run the verified domains through{" "}
              <a
                href="https://hunter.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
              >
                Hunter.io
              </a>{" "}
              /{" "}
              <a
                href="https://apollo.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
              >
                Apollo.io
              </a>
              .
            </p>
            <p className="mt-2 text-xs text-white/45">
              {withDomain.toLocaleString("en-IN")} companies have an MX-verified
              domain · {withPosted.toLocaleString("en-IN")} published a direct
              email/phone in a post. Status is saved locally in your browser only.
            </p>
          </div>
        </div>

        <OutreachTable companies={companies} />
      </div>
    </main>
  );
}
