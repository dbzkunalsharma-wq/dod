import { loadCompanyLedger } from "@/lib/jobs-data";
import {
  buildOutreachCsv,
  buildOutreachFromLedger,
  type OutreachSequence,
} from "@/lib/outreach";
import { emailTemplate, followUpTemplate } from "@/lib/outreach-templates";

/**
 * `/outreach.csv` — the placement-outreach list as a downloadable, campaign-
 * ready, RFC-4180 CSV that drops cleanly into Mailmeteor / GMass / Apollo.
 * Statically generated (`force-static`): it reads the GROWING company ledger
 * (`public/companies-ledger.json`) off disk. The ledger's domains are ALREADY
 * MX-verified at ingest, so this route does NO network I/O of any kind — no
 * per-request (or per-build) DNS. The daily auto-refresh that updates the
 * ledger re-runs the build, refreshing this export. NOINDEX is enforced via the
 * `X-Robots-Tag` header here and the `disallow` rule in app/robots.ts.
 *
 * Columns (see `OUTREACH_CSV_COLUMNS`): the company/contact/score columns, plus
 * the campaign columns currently_hiring, last_seen, first_seen, touch1_subject,
 * touch1_body, touch2_body (follow-up step 2), touch3_body (follow-up step 3),
 * and an empty cohort_portfolio_link placeholder. Bodies are the filled
 * templates with [brackets] for the team to fill once; CSV-escaped + multiline.
 */

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const ledger = await loadCompanyLedger();
  const companies = buildOutreachFromLedger(ledger);

  const csv = buildOutreachCsv(companies, (c): OutreachSequence => {
    const touch1 = emailTemplate(c);
    return {
      touch1Subject: touch1.subject,
      touch1Body: touch1.body,
      touch2Body: followUpTemplate(c, 2).body,
      touch3Body: followUpTemplate(c, 3).body,
    };
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dod-outreach.csv"',
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
