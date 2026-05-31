import { DISCIPLINE_MAP } from "./jobs";
import type { CompanyOutreach } from "./outreach";
import type { Discipline } from "./types";

/* ------------------------------------------------------------------ */
/*  Outreach mail-merge copy (deterministic string fill — no AI)       */
/*                                                                     */
/*  A placement cell fills the bracketed placeholders once             */
/*  ([Your Institute], [Your Name], [link], …) and sends. Copy is      */
/*  professional, concise and India-context; every dynamic value comes */
/*  from the CompanyOutreach model so the output is fully deterministic.*/
/* ------------------------------------------------------------------ */

export interface EmailTemplateOpts {
  /** Placement-cell / institute name. Defaults to a clear placeholder. */
  institute?: string;
  /** Sender's name. Defaults to a clear placeholder. */
  senderName?: string;
  /** Sender's role/title line. Defaults to "Placement Cell". */
  senderRole?: string;
  /** A link to the placement brochure / portfolios. Defaults to a placeholder. */
  link?: string;
}

/** Comma/ampersand-joined discipline labels for prose ("UI/UX & Product"). */
function disciplinePhrase(disciplines: Discipline[]): string {
  const labels = disciplines.map((d) => DISCIPLINE_MAP[d].label);
  if (labels.length === 0) return "design";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export interface RenderedEmail {
  subject: string;
  body: string;
}

/**
 * A complete recruiter-outreach email (subject + body) inviting a company to
 * recruit from a placement cell. References the company's live hiring
 * (`c.personalization`) and the disciplines it hires across. Placeholders the
 * team fills once are clearly bracketed: [Your Institute], [Your Name], [link].
 */
export function emailTemplate(
  c: CompanyOutreach,
  opts: EmailTemplateOpts = {}
): RenderedEmail {
  const institute = opts.institute?.trim() || "[Your Institute]";
  const senderName = opts.senderName?.trim() || "[Your Name]";
  const senderRole = opts.senderRole?.trim() || "Placement Cell";
  const link = opts.link?.trim() || "[link to student portfolios / brochure]";

  const disciplines = disciplinePhrase(c.disciplines);
  const subject = `${institute} × ${c.name}: design talent for your open roles`;

  const body = [
    `Hi ${c.name} team,`,
    "",
    `I lead recruitment partnerships at ${institute}. We noticed ${c.personalization}, and I'd love to introduce our graduating ${disciplines} design students for these and upcoming openings.`,
    "",
    `Our students train across ${disciplines} design with strong portfolios and live-project experience, and many are open to roles across India. We can share a curated shortlist matched to your requirements, or host you for a campus / virtual placement drive at a time that suits your team.`,
    "",
    `You can view sample portfolios here: ${link}`,
    "",
    `Would you be open to a quick 15-minute call to explore a hiring partnership? Happy to work around your calendar.`,
    "",
    "Warm regards,",
    senderName,
    `${senderRole}, ${institute}`,
    "[Phone] · [Email]",
  ].join("\n");

  return { subject, body };
}

/**
 * A short LinkedIn InMail version of the outreach — tighter than the email,
 * since InMail rewards brevity. Same bracketed placeholders.
 */
export function inmailTemplate(
  c: CompanyOutreach,
  opts: EmailTemplateOpts = {}
): string {
  const institute = opts.institute?.trim() || "[Your Institute]";
  const senderName = opts.senderName?.trim() || "[Your Name]";
  const disciplines = disciplinePhrase(c.disciplines);

  return [
    `Hi — I'm ${senderName} from the ${institute} placement cell.`,
    "",
    `Saw that ${c.personalization}. We have graduating ${disciplines} designers with strong portfolios who'd be a great fit. Could I share a shortlist, or set up a short call about a hiring partnership?`,
    "",
    "Thanks for considering!",
  ].join("\n");
}
