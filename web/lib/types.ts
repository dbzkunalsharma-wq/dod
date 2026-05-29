export type Discipline = "uiux" | "product" | "communication" | "industrial";

export type Source =
  | "linkedin"
  | "unstop"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "remoteok"
  | "telegram"
  | "internshala"
  | "foundit"
  | "shine"
  | "dribbble"
  | "behance"
  | "apna"
  | "freshersworld";

export interface Job {
  id: string;
  source: Source;
  discipline: Discipline;
  title: string;
  /** May be null in the feed (e.g. some Telegram posts) — always guard. */
  company: string | null;
  /** May be null in the feed — always guard. */
  location: string | null;
  url: string;
  contact: string | null;
  posted_at: string | null;
  /** Direct company-logo URL when known; null → fall back to favicon/initials. */
  logo: string | null;
  /** Full role description (may be absent/empty in older feed rows). */
  description?: string | null;
  salary: string | null;
  seen_at: string;
}

export interface JobsFeed {
  generated_at: string;
  count: number;
  jobs: Job[];
}
