import type { Metadata } from "next";
import { OutreachTable } from "@/components/OutreachTable";
import { PageNav } from "@/components/PageNav";
import { loadCompanyLedger } from "@/lib/jobs-data";
import { buildOutreachFromLedger } from "@/lib/outreach";

/**
 * Placement outreach (server) — an INTERNAL, UNLISTED tool for a college
 * placement cell, now driven by the GROWING company ledger
 * (`public/companies-ledger.json`): every company we've ever seen hiring
 * designers in India, accumulated across daily runs, turned into a ready
 * outreach list of company-level official contacts with a hiring-intent score
 * and a three-touch follow-up sequence. Computed deterministically from the
 * ledger (`buildOutreachFromLedger`) with NO build-time network I/O — the
 * ledger's domains are already MX-verified at ingest. The table is a client
 * island that paginates the (large, growing) list.
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
  // Driven by the growing ledger. The ledger's domains are ALREADY MX-verified
  // at ingest, so there is NO build-time DNS here — `domainVerified` is set
  // directly from the presence of a verified `domain` on each row.
  const ledger = await loadCompanyLedger();
  const companies = buildOutreachFromLedger(ledger);

  const hiringNow = companies.filter((c) => c.currentlyHiring).length;
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
            Company-level official contacts from a growing ledger of{" "}
            {companies.length.toLocaleString("en-IN")} companies seen hiring
            designers in India —{" "}
            <span className="text-white/80">
              {hiringNow.toLocaleString("en-IN")} hiring right now
            </span>{" "}
            — ranked by hiring intent, with a three-touch follow-up sequence, so
            the placement cell can invite the hottest employers to recruit first.
            The ledger grows every day.
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
              are common address patterns derived from each company&rsquo;s{" "}
              <span className="text-white/85">
                already MX-verified domain
              </span>{" "}
              (verified at ingest — companies without a verified domain show no
              guessed address), so the addresses shown can actually receive
              mail. Green badges are recruiter emails the company itself
              published in a job post (already verified by them). For verified
              individual recruiter emails at scale, hit{" "}
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
              email/phone in a post. Download the CSV for a campaign-ready,
              three-touch mail-merge (Mailmeteor / GMass / Apollo). Status is
              saved locally in your browser only.
            </p>
          </div>
        </div>

        <OutreachTable companies={companies} />
      </div>
    </main>
  );
}
