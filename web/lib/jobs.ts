import type { Discipline, Job, Source } from "./types";

/* ------------------------------------------------------------------ */
/*  Discipline metadata                                                */
/* ------------------------------------------------------------------ */

export interface DisciplineMeta {
  key: Discipline;
  label: string;
  /** Tailwind class fragments — written as literals so v4 can detect them. */
  dot: string; // bg color for the small accent dot
  text: string; // accent text color
  badge: string; // full badge classes (bg + text + ring)
  glow: string; // hover accent ring / shadow tint (job card)

  /* Vibrant gradient system — powers the big filter cards + card accents. */
  gradient: string; // vivid bg-gradient for the filter card / hover fills
  topLine: string; // gradient for the job-card accent top-line / rail
  ring: string; // active ring tint for the filter card
  glowShadow: string; // colored drop-glow shadow class for the active card
  hoverGlow: string; // soft hue glow on job-card hover
  avatarTint: string; // subtle hue wash behind the initials-avatar circle
}

export const DISCIPLINES: DisciplineMeta[] = [
  {
    key: "uiux",
    label: "UI/UX",
    dot: "bg-violet-400",
    text: "text-violet-300",
    badge: "bg-violet-500/10 text-violet-300 ring-violet-400/20",
    glow: "group-hover:border-violet-400/40 group-hover:shadow-violet-500/10",
    gradient: "bg-gradient-to-br from-violet-500 via-indigo-500 to-fuchsia-500",
    topLine: "bg-gradient-to-r from-violet-400 via-indigo-400 to-fuchsia-400",
    ring: "ring-violet-300/60",
    glowShadow: "shadow-[0_12px_48px_-8px_rgba(139,92,246,0.55)]",
    hoverGlow:
      "group-hover:border-violet-400/40 group-hover:shadow-[0_18px_50px_-18px_rgba(139,92,246,0.5)]",
    avatarTint:
      "bg-gradient-to-br from-violet-500/25 to-indigo-500/15 text-violet-50",
  },
  {
    key: "product",
    label: "Product",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    badge: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20",
    glow: "group-hover:border-emerald-400/40 group-hover:shadow-emerald-500/10",
    gradient: "bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-500",
    topLine: "bg-gradient-to-r from-emerald-400 to-teal-400",
    ring: "ring-emerald-300/60",
    glowShadow: "shadow-[0_12px_48px_-8px_rgba(16,185,129,0.5)]",
    hoverGlow:
      "group-hover:border-emerald-400/40 group-hover:shadow-[0_18px_50px_-18px_rgba(16,185,129,0.45)]",
    avatarTint:
      "bg-gradient-to-br from-emerald-500/25 to-teal-500/15 text-emerald-50",
  },
  {
    key: "communication",
    label: "Communication",
    dot: "bg-amber-400",
    text: "text-amber-300",
    badge: "bg-amber-500/10 text-amber-300 ring-amber-400/20",
    glow: "group-hover:border-amber-400/40 group-hover:shadow-amber-500/10",
    gradient: "bg-gradient-to-br from-amber-500 via-amber-500 to-orange-500",
    topLine: "bg-gradient-to-r from-amber-400 to-orange-400",
    ring: "ring-amber-300/60",
    glowShadow: "shadow-[0_12px_48px_-8px_rgba(245,158,11,0.5)]",
    hoverGlow:
      "group-hover:border-amber-400/40 group-hover:shadow-[0_18px_50px_-18px_rgba(245,158,11,0.45)]",
    avatarTint:
      "bg-gradient-to-br from-amber-500/25 to-orange-500/15 text-amber-50",
  },
  {
    key: "industrial",
    label: "Industrial",
    dot: "bg-sky-400",
    text: "text-sky-300",
    badge: "bg-sky-500/10 text-sky-300 ring-sky-400/20",
    glow: "group-hover:border-sky-400/40 group-hover:shadow-sky-500/10",
    gradient: "bg-gradient-to-br from-sky-400 via-sky-500 to-blue-500",
    topLine: "bg-gradient-to-r from-sky-400 to-blue-400",
    ring: "ring-sky-300/60",
    glowShadow: "shadow-[0_12px_48px_-8px_rgba(14,165,233,0.5)]",
    hoverGlow:
      "group-hover:border-sky-400/40 group-hover:shadow-[0_18px_50px_-18px_rgba(14,165,233,0.45)]",
    avatarTint:
      "bg-gradient-to-br from-sky-500/25 to-blue-500/15 text-sky-50",
  },
];

export const DISCIPLINE_MAP: Record<Discipline, DisciplineMeta> =
  Object.fromEntries(DISCIPLINES.map((d) => [d.key, d])) as Record<
    Discipline,
    DisciplineMeta
  >;

/* ------------------------------------------------------------------ */
/*  Source metadata                                                    */
/* ------------------------------------------------------------------ */

export const SOURCE_LABELS: Record<Source, string> = {
  linkedin: "LinkedIn",
  unstop: "Unstop",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  remoteok: "RemoteOK",
  telegram: "Telegram",
  internshala: "Internshala",
  foundit: "Foundit",
  shine: "Shine",
  dribbble: "Dribbble",
  behance: "Behance",
  apna: "Apna",
};

/** Stable display order for source chips (biggest India sources first). */
export const SOURCE_ORDER: Source[] = [
  "linkedin",
  "foundit",
  "unstop",
  "internshala",
  "apna",
  "shine",
  "behance",
  "dribbble",
  "greenhouse",
  "lever",
  "ashby",
  "remoteok",
  "telegram",
];

export function sourceLabel(source: string): string {
  return (SOURCE_LABELS as Record<string, string>)[source] ?? source;
}

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * The effective timestamp used for sorting & "Nd ago" — prefers
 * `posted_at`, falling back to `seen_at`. Returns epoch ms (or 0 if
 * unparseable so such rows sink to the bottom).
 */
export function effectiveTime(job: Job): number {
  const raw = job.posted_at ?? job.seen_at;
  const ms = parseLoose(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Parse a date that may be either an ISO date ("2026-05-27") or a
 * loose "YYYY-MM-DD HH:MM:SS" stamp. The space variant is normalised
 * to a `T` so Safari/strict parsers don't choke.
 */
function parseLoose(value: string | null | undefined): number {
  if (!value) return NaN;
  const normalised = value.includes(" ") ? value.replace(" ", "T") : value;
  return new Date(normalised).getTime();
}

/**
 * Compact relative time: "just now", "5m ago", "3h ago", "5d ago",
 * else an absolute short date ("20 May"). `now` is injectable for
 * deterministic rendering / tests.
 */
export function relativeTime(
  value: string | null | undefined,
  now: number = Date.now()
): string {
  const ms = parseLoose(value);
  if (Number.isNaN(ms)) return "—";

  const diff = now - ms;
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  if (sec < 45) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 30) return `${day}d ago`;

  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/** "Nd ago" style used in the card meta row (always relative, never absolute). */
export function postedAgo(job: Job, now: number = Date.now()): string {
  return relativeTime(job.posted_at ?? job.seen_at, now);
}

/* ------------------------------------------------------------------ */
/*  Company identity helpers (logo fallback chain)                     */
/* ------------------------------------------------------------------ */

/**
 * 1–2 uppercase letters for the initials-avatar fallback. Uses the first
 * letters of the first two "words" of the company name, skipping common
 * legal suffixes / noise. Falls back to "?" when there's nothing usable.
 */
export function companyInitials(company: string | null | undefined): string {
  if (!company) return "?";
  const cleaned = company
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ") // drop punctuation (commas, dots, &)
    .trim();
  if (!cleaned) return "?";
  const skip = new Set([
    "the",
    "pvt",
    "ltd",
    "inc",
    "llc",
    "llp",
    "co",
    "corp",
    "company",
    "technologies",
    "technology",
    "labs",
    "studio",
    "studios",
    "design",
    "designs",
  ]);
  const words = cleaned
    .split(/\s+/)
    .filter((w) => w && !skip.has(w.toLowerCase()));
  const pick = words.length > 0 ? words : cleaned.split(/\s+/);
  const letters = pick
    .slice(0, 2)
    .map((w) => [...w][0])
    .join("");
  return (letters || [...cleaned][0] || "?").toUpperCase().slice(0, 2);
}

/**
 * Best-effort domain guess from a company name, used only for the optional
 * favicon fallback (`google s2 favicons`). Returns null when the name is too
 * sparse to guess from. This is heuristic — the initials avatar remains the
 * guaranteed final fallback if the favicon 404s.
 */
export function guessDomain(company: string | null | undefined): string | null {
  if (!company) return null;
  const slug = company
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(pvt|private|ltd|limited|inc|llc|llp|co|corp|company)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
  if (slug.length < 2) return null;
  return `${slug}.com`;
}

/** Google S2 favicon URL for a guessed domain (or null if undecidable). */
export function faviconUrl(
  company: string | null | undefined,
  size = 64
): string | null {
  const domain = guessDomain(company);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?sz=${size}&domain=${domain}`;
}

/**
 * Resolve a `contact` string to a clickable href: emails → `mailto:`,
 * Telegram handles (`@name`) → t.me link. Returns null for free-text
 * contacts (rendered as plain text by callers).
 */
export function contactHref(contact: string): string | null {
  const c = contact.trim();
  if (c.includes("@") && c.includes(".") && !c.startsWith("@")) {
    return `mailto:${c}`;
  }
  if (c.startsWith("@")) {
    return `https://t.me/${c.slice(1)}`;
  }
  if (isPhoneContact(c)) {
    return `tel:${c.replace(/[^\d+]/g, "")}`;
  }
  if (/wa\.me\/|whatsapp/i.test(c)) {
    const digits = c.replace(/[^\d]/g, "");
    return digits ? `https://wa.me/${digits}` : null;
  }
  return null;
}

/** True when a contact string looks like a bare phone number (≥8 digits). */
export function isPhoneContact(contact: string | null | undefined): boolean {
  if (!contact) return false;
  const c = contact.trim();
  if (c.includes("@")) return false; // email / handle
  const digits = c.replace(/[^\d]/g, "");
  return digits.length >= 8 && /^[+\d][\d\s()+-]+$/.test(c);
}

/** True when a contact resolves to an email (mailto-able). */
export function isEmailContact(contact: string | null | undefined): boolean {
  if (!contact) return false;
  const c = contact.trim();
  return c.includes("@") && c.includes(".") && !c.startsWith("@");
}

/* ------------------------------------------------------------------ */
/*  Derived facets — seniority, work-type, freshness                   */
/*  Deterministic, title/source-driven (no backend, no ML).            */
/* ------------------------------------------------------------------ */

export type Seniority = "fresher" | "senior";
export type WorkType = "internship" | "full-time";

/** Title tokens that signal an early-career / fresher-friendly role. */
const FRESHER_RE =
  /\b(intern|interns|internship|junior|jr|trainee|graduate|grad|associate|entry[\s-]?level|fresher|fresh\s?grad)\b/i;

/** Title tokens that signal a senior / leadership role. */
const SENIOR_RE =
  /\b(senior|sr|lead|principal|staff|manager|head|director|architect|vp|chief)\b/i;

/** Title / source tokens that signal an internship. */
const INTERN_RE = /\b(intern|interns|internship)\b/i;

/**
 * Seniority of a role, derived from the title (deterministic, no backend):
 *   - an explicit fresher token (intern / junior / trainee / graduate /
 *     associate / entry-level …) → "fresher" (wins over a stray senior word);
 *   - otherwise a senior token (senior / lead / principal / manager …) →
 *     "senior";
 *   - otherwise "fresher" — most untitled-seniority design roles in the feed
 *     are entry-level, so the default is fresher-friendly.
 */
export function seniority(job: Job): Seniority {
  const title = job.title ?? "";
  if (FRESHER_RE.test(title)) return "fresher";
  if (SENIOR_RE.test(title)) return "senior";
  return "fresher";
}

/** Whether a role is fresher-friendly (the inverse of a clear senior signal). */
export function isFresherFriendly(job: Job): boolean {
  return seniority(job) === "fresher";
}

/**
 * Work type. An internship when the title says so, or when the source is a
 * dedicated internship board (Internshala). Everything else is full-time.
 */
export function workType(job: Job): WorkType {
  if (INTERN_RE.test(job.title ?? "")) return "internship";
  if (job.source === "internshala") return "internship";
  return "full-time";
}

/** Whether a role is an internship. */
export function isInternship(job: Job): boolean {
  return workType(job) === "internship";
}

/** Window (ms) within which a role is flagged "NEW". */
export const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * True when the role's effective time (posted_at ?? seen_at) is within the
 * last 48h. `now` is injectable for deterministic rendering / tests.
 */
export function isNew(job: Job, now: number = Date.now()): boolean {
  const t = effectiveTime(job);
  if (t === 0) return false;
  return now - t <= NEW_WINDOW_MS && now - t >= 0;
}

/* ------------------------------------------------------------------ */
/*  Apply-assist — template-only cold-outreach note (no AI / API)      */
/* ------------------------------------------------------------------ */

/**
 * A tailored, template-based cold-outreach note for a role. Pure string
 * interpolation over the job's title + company — deterministic, no network.
 */
export function applyNote(job: Job): string {
  const role = (job.title ?? "the role").trim();
  const at = job.company ? ` at ${job.company.trim()}` : "";
  const company = job.company ? job.company.trim() : "your team";
  return [
    `Hi ${company},`,
    "",
    `I'm a designer keen on the ${role} role${at}. I've attached my portfolio — I'd love to share how my work could add value, and I'm happy to walk through any of the projects.`,
    "",
    "Looking forward to hearing from you.",
    "",
    "Best regards,",
  ].join("\n");
}

/** Suggested email subject line for the apply-assist note. */
export function applySubject(job: Job): string {
  const role = (job.title ?? "Design role").trim();
  return job.company
    ? `Application: ${role} at ${job.company.trim()}`
    : `Application: ${role}`;
}

/**
 * A `mailto:` URL with the role subject + outreach note prefilled. Returns
 * null when the contact isn't a usable email.
 */
export function applyMailtoHref(job: Job): string | null {
  if (!job.contact || !isEmailContact(job.contact)) return null;
  const to = job.contact.trim();
  const subject = encodeURIComponent(applySubject(job));
  const body = encodeURIComponent(applyNote(job));
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
