"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Outreach status tracking, persisted to localStorage (no backend).
 *
 * Mirrors `lib/useTracker.ts`: a single JSON map keyed by company `slug` lives
 * under `dod:outreach`, components subscribe via `useSyncExternalStore` (so any
 * status change re-renders every consumer in sync, and across tabs via the
 * `storage` event), and the server snapshot is the frozen empty map so
 * hydration never warns.
 *
 * Unlike the job tracker (which has both a `saved` flag and a status), an
 * outreach entry is purely a pipeline status, so we store the status string
 * directly. "none" entries are pruned to keep storage tidy.
 */

export type OutreachStatus =
  | "none"
  | "to-contact"
  | "contacted"
  | "replied"
  | "scheduled";

export type OutreachMap = Record<string, Exclude<OutreachStatus, "none">>;

const STORAGE_KEY = "dod:outreach";
const EMPTY: OutreachMap = Object.freeze({});

/** Pipeline order for the segmented selector + the status filter. */
export const OUTREACH_STATUS_ORDER: Exclude<OutreachStatus, "none">[] = [
  "to-contact",
  "contacted",
  "replied",
  "scheduled",
];

export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  none: "No status",
  "to-contact": "To contact",
  contacted: "Contacted",
  replied: "Replied",
  scheduled: "Scheduled",
};

/* ----------------------------- the store ------------------------------ */

let cache: OutreachMap = EMPTY;
const listeners = new Set<() => void>();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isStatus(v: unknown): v is Exclude<OutreachStatus, "none"> {
  return (
    v === "to-contact" ||
    v === "contacted" ||
    v === "replied" ||
    v === "scheduled"
  );
}

function read(): OutreachMap {
  if (!isBrowser()) return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return EMPTY;
    const out: OutreachMap = {};
    for (const [slug, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (isStatus(val)) out[slug] = val;
    }
    return out;
  } catch {
    return EMPTY;
  }
}

function persist(next: OutreachMap) {
  cache = next;
  if (isBrowser()) {
    try {
      if (Object.keys(next).length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      /* quota / privacy mode — keep in-memory cache only */
    }
  }
  for (const l of listeners) l();
}

let initialised = false;

function subscribe(listener: () => void): () => void {
  if (!initialised && isBrowser()) {
    cache = read();
    initialised = true;
  }
  listeners.add(listener);

  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = read();
      for (const l of listeners) l();
    }
  };
  if (isBrowser()) window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    if (isBrowser()) window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => cache;
const getServerSnapshot = () => EMPTY;

/* ----------------------------- mutations ------------------------------ */

function writeStatus(slug: string, status: OutreachStatus) {
  const next = { ...cache };
  if (status === "none") {
    delete next[slug];
  } else {
    next[slug] = status;
  }
  persist(next);
}

/* ------------------------------ the hook ------------------------------ */

export interface OutreachApi {
  /** The full persisted map (stable identity between unrelated renders). */
  map: OutreachMap;
  /** Current status for a company slug ("none" when untracked). */
  statusOf: (slug: string) => OutreachStatus;
  /** Set (or, with "none", clear) a company's status. */
  setStatus: (slug: string, status: OutreachStatus) => void;
  /** Count of entries at a given status across the whole map. */
  countOf: (status: Exclude<OutreachStatus, "none">) => number;
}

export function useOutreach(): OutreachApi {
  const map = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const statusOf = useCallback(
    (slug: string): OutreachStatus => map[slug] ?? "none",
    [map]
  );
  const setStatus = useCallback(
    (slug: string, status: OutreachStatus) => writeStatus(slug, status),
    []
  );
  const countOf = useCallback(
    (status: Exclude<OutreachStatus, "none">) =>
      Object.values(map).filter((s) => s === status).length,
    [map]
  );

  return { map, statusOf, setStatus, countOf };
}
