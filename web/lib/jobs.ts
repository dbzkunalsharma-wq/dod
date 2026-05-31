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
  freshersworld: "Freshersworld",
};

/** Stable display order for source chips (biggest India sources first). */
export const SOURCE_ORDER: Source[] = [
  "linkedin",
  "foundit",
  "unstop",
  "internshala",
  "freshersworld",
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

/**
 * URL/route slug for a job id. Job ids contain colons ("linkedin:12345"), which
 * are an illegal filename char on Windows (breaking the static build) and get
 * percent-encoded in URLs (which then don't match the prerendered segment, → 404).
 * We map ":" → "~" — an RFC-3986 *unreserved* char, so it's never percent-encoded
 * and is a legal filename on every OS. No id contains "~", so the map is exact.
 * Used by every per-job href, canonical, sitemap entry, and generateStaticParams.
 */
export function jobSlug(id: string): string {
  return id.replace(/:/g, "~");
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

/** Real posting age for the card meta. Uses `posted_at` ONLY — when a source didn't
 *  expose a posting date we say "Recently" rather than falling back to `seen_at` (which
 *  is just when WE scraped it, and made weeks-old posts read as "6h ago"). */
export function postedAgo(job: Job, now: number = Date.now()): string {
  return job.posted_at ? relativeTime(job.posted_at, now) : "Recently";
}

/**
 * Whether a role's effective date (posted_at ?? seen_at) falls within the last
 * `days` of `now` — backs the "Date posted" filter. Unparseable / future
 * timestamps fall outside any window. `now` is injectable for tests.
 */
export function withinDays(job: Job, days: number, now: number = Date.now()): boolean {
  const t = effectiveTime(job);
  if (t === 0) return false;
  const diff = now - t;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
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

/* ------------------------------------------------------------------ */
/*  Top companies — curated leaders + matcher (deterministic, no ML)   */
/*                                                                     */
/*  A hand-picked list of design-respected global leaders + top Indian */
/*  product companies / startups / studios. Matching is robust: the    */
/*  job's company string is lowercased and stripped of legal / suffix  */
/*  noise, then compared by *whole word* / equality against each top   */
/*  token — never a loose substring. This keeps "metamorph" away from  */
/*  "meta", "canvas" away from "canva", and "credit" away from "cred", */
/*  while still matching "Navi" / "Ola" when they stand alone.         */
/* ------------------------------------------------------------------ */

/** Canonical display names for the curated top companies. */
export const TOP_COMPANIES: string[] = [
  // Global design-respected leaders
  "Google",
  "Microsoft",
  "Adobe",
  "Apple",
  "Amazon",
  "Meta",
  "Netflix",
  "Uber",
  "Airbnb",
  "Spotify",
  "Figma",
  "Atlassian",
  "Salesforce",
  "Intuit",
  "LinkedIn",
  "Stripe",
  "Notion",
  "Canva",
  "Miro",
  "Dropbox",
  "Shopify",
  "Booking",
  "Twilio",
  "Zoom",
  "Slack",
  "Pinterest",
  "Snap",
  "Autodesk",
  "SAP",
  "Oracle",
  "IBM",
  "Walmart",
  "Goldman Sachs",
  "JPMorgan",
  "Visa",
  "Mastercard",
  "Coinbase",
  "GitHub",
  "GitLab",
  "MongoDB",
  "Databricks",
  "ServiceNow",
  "Workday",
  "Wayfair",
  "ThoughtWorks",
  "Nvidia",
  "PayPal",
  // Top Indian product companies / startups
  "Razorpay",
  "CRED",
  "Swiggy",
  "Zomato",
  "Flipkart",
  "PhonePe",
  "Paytm",
  "Groww",
  "Meesho",
  "Zerodha",
  "Postman",
  "Zeta",
  "ShareChat",
  "Unacademy",
  "Ola",
  "Myntra",
  "Nykaa",
  "Dream11",
  "Slice",
  "Jupiter",
  "Navi",
  "Zepto",
  "Rapido",
  "Urban Company",
  "BrowserStack",
  "Freshworks",
  "Zoho",
  "Hotstar",
  "Cult.fit",
  "Cure.fit",
  "Dunzo",
  "BigBasket",
  "Cars24",
  "Spinny",
  "CoinDCX",
  "CoinSwitch",
  "Chargebee",
  "Hasura",
  "Innovaccer",
  "MPL",
  "PharmEasy",
  "Practo",
  "Lenskart",
  "BookMyShow",
  "MakeMyTrip",
  "Cleartrip",
  "Fi Money",
  "smallcase",
  "INDmoney",
  "Juspay",
  "Pine Labs",
  "Cashfree",
  "Physics Wallah",
  "upGrad",
  "Vedantu",
  // Top design studios (India + global)
  "Lollypop",
  "Obvious",
  "Fractal Ink",
  "Codewave",
  "Parallel",
  "Think Design",
  "Studio ABD",
  "F1 Studioz",
  "Ittisa",
  "Pentagram",
  "IDEO",
  "Instrument",
  "Work & Co",
  "Designit",
  "Ueno",
  "MetaLab",
  "Ramotion",
  "Koto",
  "Landor",
  "R/GA",
  // Design-forward startups / products
  "Linear",
  "Framer",
  "Webflow",
  "Vercel",
  "Retool",
  "Superhuman",
  "Raycast",
  "Zeplin",
  "The Browser Company",
  "Headout",
  "Hyperface",
  "Onsurity",
  "Classplus",
  "Fampay",
  "Rupeek",
  "epiFi",
];

/**
 * Normalise a company name for top-company matching: lowercase, fold accents,
 * drop punctuation, and strip common legal / suffix noise words so e.g.
 * "Razorpay Software Pvt Ltd" → "razorpay" and "Walmart Global Tech India" →
 * "walmart tech". Returns the cleaned token list (whitespace-joined too).
 */
export function normalizeCompany(company: string): string {
  const skip = new Set([
    "pvt",
    "private",
    "limited",
    "ltd",
    "llc",
    "llp",
    "inc",
    "incorporated",
    "corp",
    "corporation",
    "co",
    "company",
    "technologies",
    "technology",
    "technolabs",
    "tech",
    "labs",
    "lab",
    "india",
    "indian",
    "global",
    "solutions",
    "solution",
    "systems",
    "system",
    "the",
    "group",
    "ventures",
    "enterprises",
    "services",
    "studio",
    "studios",
  ]);
  return company
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]+/g, " ") // drop punctuation (dots, commas, |, …)
    .split(/\s+/)
    .filter((w) => w && !skip.has(w))
    .join(" ")
    .trim();
}

/**
 * Short / ambiguous normalized tokens that must match by EXACT equality only —
 * never startsWith / containment — so common words don't masquerade as brands
 * ("Metadata" ≠ Meta, "Credflow" ≠ CRED, "Jarvis" ≠ Jar, "Fintech" ≠ Fi). The
 * brief calls these out explicitly. "Jio Platforms" / "Ola Electric" therefore
 * won't match — a deliberately conservative trade-off for these few names.
 */
const AMBIGUOUS_TOKENS = new Set<string>([
  "ola",
  "meta",
  "snap",
  "cred",
  "jio",
  "jar",
  "fi",
  "zeta",
  "navi",
]);

/**
 * Confirmed real-world collisions: distinct companies whose normalized name
 * starts with a curated brand token but are NOT that brand. Kept tiny and
 * data-driven (these appear in the live feed). Matched against the *fully
 * cleaned* name, so suffix noise is already stripped.
 */
const TOP_COMPANY_DENYLIST = new Set<string>([
  "amazon filters", // UK water-filtration co, not Amazon
  "digital apple", // small agency, not Apple (also fails the startsWith rule)
]);

/**
 * Pre-computed lookup of `normalized top token → canonical display name`.
 * (e.g. "goldman sachs" → "Goldman Sachs", "cred" → "CRED".) Built once.
 */
const TOP_COMPANY_LOOKUP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const name of TOP_COMPANIES) {
    const key = normalizeCompany(name);
    if (key) m.set(key, name);
  }
  return m;
})();

/**
 * The canonical top-company display name a company string matches, or null.
 *
 * Match rules (anchored / equality only — never a loose substring):
 *   1. the fully-cleaned name EQUALS a top token  ("razorpay" → Razorpay); or
 *   2. for *distinctive* brands, the cleaned name STARTS WITH the token at a
 *      word boundary  ("walmart global tech" → Walmart, "google india" →
 *      Google, "lollypop design" → Lollypop). A trailing brand never matches,
 *      so "Digital Apple" is NOT Apple and "design by metamorph" is NOT Meta.
 *   3. *ambiguous* short tokens (ola, meta, snap, cred, jio, jar, fi, zeta,
 *      navi) match by EXACT equality only — "Metadata"/"Credflow" stay out.
 *
 * A small denylist removes confirmed real-world collisions ("Amazon Filters").
 * Multi-word tokens ("goldman sachs", "urban company") are matched as a whole
 * phrase. The longest matching token wins so a more specific brand prevails.
 */
export function topCompanyName(company: string | null): string | null {
  if (!company) return null;
  const cleaned = normalizeCompany(company);
  if (!cleaned) return null;

  // Fast path: exact equality on the whole cleaned name.
  const exact = TOP_COMPANY_LOOKUP.get(cleaned);
  if (exact) return exact;

  if (TOP_COMPANY_DENYLIST.has(cleaned)) return null;

  // Anchored startsWith for distinctive brands: the cleaned name must *begin*
  // with the token followed by a word boundary (or be equal — covered above).
  // Ambiguous short tokens are exact-only and so were already handled by the
  // fast path; they never reach the startsWith test. Prefer the longest token
  // so a more specific multi-word brand wins.
  let best: string | null = null;
  let bestLen = 0;
  for (const [token, name] of TOP_COMPANY_LOOKUP) {
    if (token.length <= bestLen) continue;
    if (AMBIGUOUS_TOKENS.has(token)) continue; // exact-only — not here
    if (cleaned === token || cleaned.startsWith(`${token} `)) {
      best = name;
      bestLen = token.length;
    }
  }
  return best;
}

/** Whether a company is one of the curated top companies (robust match). */
export function isTopCompany(company: string | null): boolean {
  return topCompanyName(company) !== null;
}

/* ------------------------------------------------------------------ */
/*  Reputation tier + "Top picks" composite ranking (deterministic)    */
/*                                                                     */
/*  A curated *elite* subset of the most prestigious names sits above  */
/*  the broader top-companies list, giving the default "Top picks" sort */
/*  a two-level reputation signal. Matching reuses the SAME company     */
/*  normalisation as `isTopCompany` (lowercase, suffix-stripped, then   */
/*  exact-equality on the cleaned name) so e.g. "Google India Pvt Ltd"  */
/*  → elite, while "Metadata" never masquerades as Meta.               */
/* ------------------------------------------------------------------ */

/** Canonical display names for the most prestigious "elite" companies. */
const ELITE_COMPANY_NAMES: string[] = [
  "Google",
  "Microsoft",
  "Apple",
  "Adobe",
  "Amazon",
  "Meta",
  "Netflix",
  "Figma",
  "Stripe",
  "Atlassian",
  "Uber",
  "Airbnb",
  "Spotify",
  "Salesforce",
  "Nvidia",
  "Razorpay",
  "CRED",
  "Swiggy",
  "Zomato",
  "Flipkart",
  "PhonePe",
  "Zerodha",
  "Postman",
];

/**
 * Normalised (cleaned) tokens for the elite companies — built once with the
 * SAME `normalizeCompany` used for top-company matching, so membership tests
 * line up exactly with `isTopCompany`'s view of a name.
 */
export const ELITE_COMPANIES: Set<string> = new Set(
  ELITE_COMPANY_NAMES.map((n) => normalizeCompany(n)).filter(Boolean)
);

/**
 * Reputation tier for a company (higher = more prestigious):
 *   2 → elite (in `ELITE_COMPANIES`, matched on the normalised name),
 *   1 → a curated top company that isn't elite (`isTopCompany`),
 *   0 → everything else (incl. null / nameless).
 */
export function reputationTier(company: string | null): number {
  if (!company) return 0;
  const cleaned = normalizeCompany(company);
  if (cleaned && ELITE_COMPANIES.has(cleaned)) return 2;
  return isTopCompany(company) ? 1 : 0;
}

/**
 * Whether a role is "recent" — its effective time (posted_at ?? seen_at) is
 * within the last `days` (default 30) of `Date.now()`. Unparseable / future
 * timestamps are not recent. Deterministic given a fixed clock.
 */
export function isRecentJob(job: Job, days = 30): boolean {
  const t = effectiveTime(job);
  if (t === 0) return false;
  const diff = Date.now() - t;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

/**
 * "Top picks" composite comparator (negative ⇒ `a` ranks first). A pure,
 * deterministic ordering — no ML, no randomness — applying these tiers in
 * strict priority:
 *
 *   1. Recent top-company first: rt(x) = isTopCompany(x.company) && isRecentJob(x).
 *      A fresh role at a respected company is the headline pick.
 *   2. Company reputation: higher `reputationTier` first (elite > top > rest).
 *   3. Pay: higher `salaryValue(x.salary)` first (no/zero salary sinks).
 *   4. Recency: newer `effectiveTime` first.
 */
export function compareTopPicks(a: Job, b: Job): number {
  // (1) Recent top-company roles float to the very top.
  const rtA = isTopCompany(a.company) && isRecentJob(a);
  const rtB = isTopCompany(b.company) && isRecentJob(b);
  if (rtA !== rtB) return rtA ? -1 : 1;

  // (2) Company reputation (elite > top > rest).
  const repA = reputationTier(a.company);
  const repB = reputationTier(b.company);
  if (repA !== repB) return repB - repA;

  // (3) Pay (higher first; zero/unparseable sinks).
  const sa = salaryValue(a.salary);
  const sb = salaryValue(b.salary);
  if (sa !== sb) return sb - sa;

  // (4) Recency (newer first).
  return effectiveTime(b) - effectiveTime(a);
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

/* ------------------------------------------------------------------ */
/*  Experience level — Intern / Entry / Mid / Senior                   */
/*  Deterministic, title + description driven (no backend, no ML).     */
/* ------------------------------------------------------------------ */

export type ExperienceLevel = "intern" | "entry" | "mid" | "senior";

export interface ExperienceMeta {
  key: ExperienceLevel;
  label: string;
}

/** Display order for the experience-level chips (junior → senior). */
export const EXPERIENCE_LEVELS: ExperienceMeta[] = [
  { key: "intern", label: "Intern" },
  { key: "entry", label: "Entry" },
  { key: "mid", label: "Mid" },
  { key: "senior", label: "Senior" },
];

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> =
  Object.fromEntries(
    EXPERIENCE_LEVELS.map((e) => [e.key, e.label])
  ) as Record<ExperienceLevel, string>;

/** Entry-level / early-career signals (junior, fresher, associate, 0–2 yrs…). */
const ENTRY_RE =
  /\b(junior|jr|fresher|fresh\s?grad|entry[\s-]?level|associate|graduate|grad|trainee|0\s*[-–]\s*1|0\s*[-–]\s*2|0\s*to\s*[12])\s*(?:y(?:ea)?rs?)?\b/i;

/** Senior / leadership signals. */
const SENIOR_LEVEL_RE =
  /\b(senior|sr|lead|staff|principal|manager|head|director|architect|vp|chief)\b/i;

/**
 * Experience level of a role, derived from the title + description
 * (deterministic, no backend). Precedence, strongest signal first:
 *   1. an internship token → "intern";
 *   2. an entry / early-career token (junior, fresher, associate, graduate,
 *      0-1 / 0-2 yr …) → "entry";
 *   3. a senior / leadership token (senior, lead, staff, manager, head …) →
 *      "senior";
 *   4. otherwise → "mid".
 */
export function experienceLevel(job: Job): ExperienceLevel {
  const hay = `${job.title ?? ""} ${job.description ?? ""}`;
  if (INTERN_RE.test(hay)) return "intern";
  if (ENTRY_RE.test(hay)) return "entry";
  if (SENIOR_LEVEL_RE.test(hay)) return "senior";
  return "mid";
}

/* ------------------------------------------------------------------ */
/*  Specialization facet — the role-type DEPTH within a discipline      */
/*  (UX Research, Motion, Service Design, Brand, Industrial, …).        */
/*  Deterministic, title-first then description, ordered specific →     */
/*  general, with a discipline-keyed "Generalist" fallback so it's      */
/*  never empty. No backend, no ML. Derived purely from title/desc so   */
/*  it survives the feed growing + broadening (no feed schema change).  */
/* ------------------------------------------------------------------ */

export type Specialization =
  | "ux-research"
  | "interaction"
  | "design-systems"
  | "service"
  | "content"
  | "product"
  | "ui-visual"
  | "web"
  | "graphic"
  | "brand"
  | "motion"
  | "illustration"
  | "packaging"
  | "industrial"
  | "spatial"
  | "leadership"
  | "design-ops"
  | "generalist";

export interface SpecializationMeta {
  key: Specialization;
  label: string;
}

/**
 * Ordered specific → general. This array order is ALSO the priority order used
 * by `specialization()` (the FIRST matching rule wins), and the display order
 * for the filter UI. "Generalist" sits last as the catch-all.
 */
export const SPECIALIZATIONS: SpecializationMeta[] = [
  { key: "ux-research", label: "UX Research" },
  { key: "interaction", label: "Interaction" },
  { key: "design-systems", label: "Design Systems" },
  { key: "service", label: "Service Design" },
  { key: "content", label: "Content / UX Writing" },
  { key: "product", label: "Product Design" },
  { key: "ui-visual", label: "UI / Visual" },
  { key: "web", label: "Web" },
  { key: "graphic", label: "Graphic" },
  { key: "brand", label: "Brand / Identity" },
  { key: "motion", label: "Motion / Animation" },
  { key: "illustration", label: "Illustration" },
  { key: "packaging", label: "Packaging" },
  { key: "industrial", label: "Industrial" },
  { key: "spatial", label: "Spatial / Exhibition" },
  { key: "leadership", label: "Design Leadership" },
  { key: "design-ops", label: "Design Ops" },
  { key: "generalist", label: "Generalist" },
];

export const SPECIALIZATION_LABELS: Record<Specialization, string> =
  Object.fromEntries(
    SPECIALIZATIONS.map((s) => [s.key, s.label])
  ) as Record<Specialization, string>;

/**
 * Ordered match rules (specific → general). Each is a RegExp tested against the
 * title first, then the description. The first rule that matches (in this order)
 * decides the specialization, so e.g. "Senior UX Researcher" → UX Research even
 * though "Senior" would also hit Design Leadership lower down. "Generalist" is a
 * synthetic fallback (no regex) keyed off the discipline below.
 *
 * Word boundaries (\b) keep matches honest: "ui" won't fire inside "build",
 * "cmf" won't fire inside other words, etc.
 */
const SPECIALIZATION_RULES: { key: Exclude<Specialization, "generalist">; re: RegExp }[] =
  [
    {
      key: "ux-research",
      re: /\b(ux\s*research(?:er)?|user\s*research(?:er)?|design\s*research(?:er)?|ux\s*researcher)\b/i,
    },
    { key: "interaction", re: /\binteraction\s*design(?:er)?\b/i },
    { key: "design-systems", re: /\bdesign\s*systems?\b/i },
    { key: "service", re: /\bservice\s*design(?:er)?\b/i },
    {
      key: "content",
      re: /\b(ux\s*writ(?:er|ing)|content\s*design(?:er)?|conversation(?:al)?\s*design(?:er)?)\b/i,
    },
    { key: "product", re: /\bproduct\s*design(?:er)?\b/i },
    {
      key: "ui-visual",
      re: /\b(ui\s*designer|ui\s*\/\s*ux|ui\/ux|ux\s*\/\s*ui|visual\s*design(?:er)?)\b/i,
    },
    { key: "web", re: /\bweb\s*design(?:er)?\b/i },
    { key: "graphic", re: /\bgraphic\s*design(?:er)?\b/i },
    { key: "brand", re: /\b(brand(?:ing)?|identity)\b/i },
    { key: "motion", re: /\b(motion|animation|animator)\b/i },
    { key: "illustration", re: /\b(illustrat(?:or|ion))\b/i },
    { key: "packaging", re: /\bpackaging\b/i },
    {
      key: "industrial",
      re: /\b(industrial|cmf|footwear|furniture|automotive|transportation|mobility)\b/i,
    },
    { key: "spatial", re: /\b(spatial|exhibition|experiential)\b/i },
    {
      key: "leadership",
      re: /\b(head\s*of\s*design|design\s*(?:lead|manager|director)|creative\s*director|art\s*director|principal\s*designer|staff\s*designer)\b/i,
    },
    { key: "design-ops", re: /\bdesign\s*(?:ops|operations)\b/i },
  ];

/** Discipline → its "Generalist" reading (used only for the empty-match fallback). */
function generalistFor(_discipline: Discipline): Specialization {
  // Every discipline currently folds into one shared "Generalist" bucket. Kept
  // as a function (keyed off discipline) so the fallback is principled and easy
  // to split later if a per-discipline generalist label is ever wanted.
  return "generalist";
}

/**
 * The role-type specialization of a job (deterministic, title-first then
 * description). Walks `SPECIALIZATION_RULES` in order (specific → general) and
 * returns the first match; if nothing matches, falls back to a discipline-keyed
 * "Generalist" so the value is never empty.
 *
 * Title is weighted over description by testing ALL rules against the title
 * first, only then re-walking them against the description — so a title that
 * says "Visual Designer" wins over a description that merely mentions "research".
 *
 * Quick sanity (informal — no test runner needed):
 *   "Senior UX Researcher"            → "ux-research"
 *   "UI/UX Designer"                  → "ui-visual"
 *   "Product Designer"                → "product"
 *   "Motion Graphics Designer"        → "motion"
 *   "Design Systems Lead"             → "design-systems" (beats leadership)
 *   "Head of Design"                  → "leadership"
 *   "Graphic Designer (Packaging)"    → "packaging"     (packaging > graphic)
 *   "CMF Designer"                    → "industrial"
 *   "Designer" (uiux)                 → "generalist"
 */
export function specialization(job: Job): Specialization {
  const title = job.title ?? "";
  for (const { key, re } of SPECIALIZATION_RULES) {
    if (re.test(title)) return key;
  }
  const desc = job.description ?? "";
  if (desc) {
    for (const { key, re } of SPECIALIZATION_RULES) {
      if (re.test(desc)) return key;
    }
  }
  return generalistFor(job.discipline);
}

/* ------------------------------------------------------------------ */
/*  Location facet — collapse messy location strings into clean cities */
/*  Deterministic substring matching (no backend, no ML). The feed's   */
/*  `location` is free-text ("Sector 37 Gurgaon, Delhi-NCR, India",    */
/*  "Bengaluru, Karnataka, India", "Remote (India)"), so we bucket it. */
/* ------------------------------------------------------------------ */

export type LocationKey =
  | "bengaluru"
  | "mumbai"
  | "delhi-ncr"
  | "hyderabad"
  | "pune"
  | "chennai"
  | "kolkata"
  | "ahmedabad"
  | "remote"
  | "other";

export interface LocationMeta {
  key: LocationKey;
  label: string;
}

/** Display order for the location chips (biggest design hubs first). */
export const LOCATIONS: LocationMeta[] = [
  { key: "bengaluru", label: "Bengaluru" },
  { key: "delhi-ncr", label: "Delhi NCR" },
  { key: "mumbai", label: "Mumbai" },
  { key: "hyderabad", label: "Hyderabad" },
  { key: "pune", label: "Pune" },
  { key: "chennai", label: "Chennai" },
  { key: "kolkata", label: "Kolkata" },
  { key: "ahmedabad", label: "Ahmedabad" },
  { key: "remote", label: "Remote" },
  { key: "other", label: "Other" },
];

export const LOCATION_LABELS: Record<LocationKey, string> = Object.fromEntries(
  LOCATIONS.map((l) => [l.key, l.label])
) as Record<LocationKey, string>;

/**
 * City buckets, matched as case-insensitive substrings against the location
 * string. Each bucket lists every alias that should fold into it — Delhi NCR
 * absorbs Gurgaon/Gurugram/Noida/Faridabad/Ghaziabad/New Delhi, etc. Order in
 * the bucket doesn't matter; the *first matching bucket* (by LOCATIONS order)
 * wins. "Remote" is detected separately (it can co-occur with a city).
 */
const CITY_ALIASES: Record<Exclude<LocationKey, "remote" | "other">, string[]> =
  {
    bengaluru: ["bengaluru", "bangalore", "bengalore"],
    "delhi-ncr": [
      "delhi",
      "new delhi",
      "ncr",
      "gurgaon",
      "gurugram",
      "noida",
      "faridabad",
      "ghaziabad",
    ],
    mumbai: ["mumbai", "navi mumbai", "thane", "worli", "bombay"],
    hyderabad: ["hyderabad", "secunderabad"],
    pune: ["pune", "pimpri", "chinchwad"],
    chennai: ["chennai", "madras"],
    kolkata: ["kolkata", "calcutta", "howrah"],
    ahmedabad: ["ahmedabad", "gandhinagar"],
  };

/** True when a location/title signals a remote role. */
function looksRemote(job: Job): boolean {
  const hay = `${job.location ?? ""} ${job.title ?? ""}`.toLowerCase();
  return /\bremote\b|work from home|wfh\b/.test(hay);
}

/**
 * Bucket a job into a single clean location facet. Remote wins only when no
 * concrete city is named (so "Remote, Bengaluru" still files under Bengaluru
 * and stays reachable); pure-remote / "Remote (India)" → "remote"; anything
 * with no recognised city → "other".
 */
export function locationKey(job: Job): LocationKey {
  const loc = (job.location ?? "").toLowerCase();
  for (const { key } of LOCATIONS) {
    if (key === "remote" || key === "other") continue;
    const aliases = CITY_ALIASES[key as keyof typeof CITY_ALIASES];
    if (aliases.some((a) => loc.includes(a))) return key;
  }
  if (looksRemote(job)) return "remote";
  return "other";
}

/* ------------------------------------------------------------------ */
/*  Work-type facet — Remote / Hybrid / On-site / Internship           */
/*  Derived from location + title keywords (deterministic).            */
/* ------------------------------------------------------------------ */

export type WorkMode = "remote" | "hybrid" | "onsite" | "internship";

export interface WorkModeMeta {
  key: WorkMode;
  label: string;
}

/** Display order for the work-type chips. */
export const WORK_MODES: WorkModeMeta[] = [
  { key: "remote", label: "Remote" },
  { key: "hybrid", label: "Hybrid" },
  { key: "onsite", label: "On-site" },
  { key: "internship", label: "Internship" },
];

const HYBRID_RE = /\bhybrid\b/i;

/**
 * Coarse work mode for the filter chips. Internship takes precedence (it's the
 * strongest signal a seeker filters on), then explicit hybrid, then remote,
 * else on-site (the default for a named-city role). One job → one mode, so the
 * faceted counts sum cleanly.
 */
export function workMode(job: Job): WorkMode {
  if (isInternship(job)) return "internship";
  const hay = `${job.location ?? ""} ${job.title ?? ""}`;
  if (HYBRID_RE.test(hay)) return "hybrid";
  if (looksRemote(job)) return "remote";
  return "onsite";
}

/** Whether a role has a non-empty salary string. */
export function hasSalary(job: Job): boolean {
  return !!job.salary && job.salary.trim().length > 0;
}

/* ------------------------------------------------------------------ */
/*  Salary parsing — a single sortable number (₹/year, best-effort)    */
/*  Handles the feed's formats deterministically:                      */
/*    "₹15,000–17,100/month"  → monthly, ×12                           */
/*    "₹24,000 - ₹65,000 / year" / "INR 35000-40000 annual" → yearly   */
/*    "₹2.4–7.2 LPA" / "₹12 LPA"  → lakh-per-annum, ×100,000           */
/*    "INR 10-12 annual"  → bare small numbers ⇒ treated as LPA        */
/*    "USD 75-150 monthly"  → ×~83 (INR) then ×12                      */
/*    "₹5,000 lump sum"  → one-off, parsed but de-weighted             */
/*  Returns 0 when nothing parseable, so such rows sink when sorting.  */
/* ------------------------------------------------------------------ */

/** Rough USD→INR for sort-only comparability (not shown to the user). */
const USD_INR = 83;

/**
 * Parse a salary string into an approximate annualised ₹ figure for sorting.
 * Uses the *lower* bound of a range (stable, avoids one outlier ceiling
 * dominating). Returns 0 for unparseable / empty input.
 */
export function salaryValue(salary: string | null | undefined): number {
  if (!salary) return 0;
  const raw = salary.trim();
  if (!raw) return 0;
  const lower = raw.toLowerCase();

  // Pull the numeric tokens (strip thousands separators), keep decimals.
  const nums = (raw.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? []).map(
    Number
  );
  if (nums.length === 0) return 0;
  const base = Math.min(...nums); // lower bound of the range

  const isUsd = /usd|\$/.test(lower);
  const perMonth = /month|\/m\b|p\.?m\b|monthly/.test(lower);
  const lpa = /\blpa\b|lakh|lac\b/.test(lower);
  const lumpSum = /lump\s*sum|stipend|one[-\s]?time/.test(lower);

  let annual: number;
  if (lpa) {
    annual = base * 100_000; // "₹4.5 LPA" → 450,000
  } else if (isUsd) {
    annual = base * USD_INR * (perMonth ? 12 : 1);
  } else if (perMonth) {
    annual = base * 12;
  } else if (base < 100) {
    // Bare small numbers in an annual context ("INR 10-12 annual") read as LPA.
    annual = base * 100_000;
  } else {
    annual = base; // already an annual rupee figure
  }

  // De-weight one-off / lump-sum amounts so they don't outrank real salaries.
  if (lumpSum) annual = Math.min(annual, base);
  return Math.round(annual);
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
