import { loadAllJobs } from "@/lib/jobs-data";
import {
  applyDomainVerification,
  buildOutreach,
  buildOutreachCsv,
  collectOutreachDomains,
} from "@/lib/outreach";
import { emailTemplate } from "@/lib/outreach-templates";
import { mailableDomains } from "@/lib/verify-domains";

/**
 * `/outreach.csv` — the placement-outreach list as a downloadable, RFC-4180
 * CSV. Statically generated (`force-static`): it reads the feed off disk and
 * MX-verifies the guessed domains ONCE at build time, so the per-domain DNS
 * lookups never run on a per-request basis. The daily auto-refresh that
 * updates the feed re-runs the build, refreshing this export. NOINDEX is
 * enforced via the `X-Robots-Tag` header here and the `disallow` rule in
 * app/robots.ts.
 *
 * Columns (see `OUTREACH_CSV_COLUMNS`): company, domain, careers_email,
 * hr_email, talent_email, careers_url, website_url, linkedin_company_search,
 * linkedin_ta_search, posted_emails, posted_phones, open_roles, disciplines,
 * locations, score, score_reasons, personalization, draft_email,
 * domain_verified, posted_this_week, fresh_role_count. (`posted_emails` is the
 * MX-filtered list — published addresses on dead domains are dropped.)
 */

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const jobs = await loadAllJobs();
  const rows = buildOutreach(jobs);
  // Same MX-verification overlay as the /outreach page, over the UNION of
  // guessed domains + published-email domains in one deduped lookup: drop both
  // guessed AND posted emails on domains that don't resolve / accept mail.
  // Runs once at build.
  const mailable = await mailableDomains(collectOutreachDomains(rows));
  const companies = applyDomainVerification(rows, mailable);
  const csv = buildOutreachCsv(companies, (c) => emailTemplate(c).body);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dod-outreach.csv"',
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
