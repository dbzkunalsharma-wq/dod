import { loadAllJobs } from "@/lib/jobs-data";
import { buildOutreach, buildOutreachCsv } from "@/lib/outreach";
import { emailTemplate } from "@/lib/outreach-templates";

/**
 * `/outreach.csv` — the placement-outreach list as a downloadable, RFC-4180
 * CSV. A dynamic Route Handler: it reads the feed off disk and regenerates the
 * CSV on each request, so the daily auto-refresh that updates the feed updates
 * this export automatically (no rebuild needed). NOINDEX is enforced via the
 * `X-Robots-Tag` header here and the `disallow` rule in app/robots.ts.
 *
 * Columns (see `OUTREACH_CSV_COLUMNS`): company, domain, careers_email,
 * hr_email, talent_email, careers_url, website_url, linkedin_company_search,
 * linkedin_ta_search, posted_emails, posted_phones, open_roles, disciplines,
 * locations, score, score_reasons, personalization, draft_email.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const jobs = await loadAllJobs();
  const companies = buildOutreach(jobs);
  const csv = buildOutreachCsv(companies, (c) => emailTemplate(c).body);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dod-outreach.csv"',
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
    },
  });
}
