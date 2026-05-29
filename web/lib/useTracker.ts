"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Save + status tracking, persisted to localStorage (no backend).
 *
 * A single JSON map keyed by `job.id` lives under `dod:tracker`. Components
 * subscribe via `useSyncExternalStore`, so any save/status change re-renders
 * every consumer (cards + modal) in sync, across the whole app — and across
 * browser tabs via the `storage` event.
 *
 * SSR-safe: the server snapshot is always the frozen empty map, so the first
 * client render matches the server and hydration never warns. Real persisted
 * state is read on the first client subscribe.
 */

export type JobStatus = "none" | "interested" | "applied" | "rejected";

export interface TrackedEntry {
  saved: boolean;
  status: JobStatus;
}

export type TrackerMap = Record<string, TrackedEntry>;

const STORAGE_KEY = "dod:tracker";
const EMPTY: TrackerMap = Object.freeze({});

export const STATUS_ORDER: Exclude<JobStatus, "none">[] = [
  "interested",
  "applied",
  "rejected",
];

export const STATUS_LABELS: Record<JobStatus, string> = {
  none: "Not tracked",
  interested: "Interested",
  applied: "Applied",
  rejected: "Rejected",
};

/* ----------------------------- the store ------------------------------ */

let cache: TrackerMap = EMPTY;
const listeners = new Set<() => void>();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function read(): TrackerMap {
  if (!isBrowser()) return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return EMPTY;
    // Normalise / sanitise into a clean TrackerMap.
    const out: TrackerMap = {};
    for (const [id, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (!val || typeof val !== "object") continue;
      const v = val as Partial<TrackedEntry>;
      const status = isStatus(v.status) ? v.status : "none";
      const saved = v.saved === true;
      if (saved || status !== "none") out[id] = { saved, status };
    }
    return out;
  } catch {
    return EMPTY;
  }
}

function isStatus(v: unknown): v is JobStatus {
  return (
    v === "none" ||
    v === "interested" ||
    v === "applied" ||
    v === "rejected"
  );
}

function persist(next: TrackerMap) {
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

  // Keep multiple tabs in sync.
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

function setEntry(id: string, patch: Partial<TrackedEntry>) {
  const prev = cache[id] ?? { saved: false, status: "none" as JobStatus };
  const merged: TrackedEntry = { ...prev, ...patch };
  const next = { ...cache };
  // Drop entries that carry no information (keeps storage tidy).
  if (!merged.saved && merged.status === "none") {
    delete next[id];
  } else {
    next[id] = merged;
  }
  persist(next);
}

/* ------------------------------ the hook ------------------------------ */

export interface TrackerApi {
  /** The full persisted map (stable identity between unrelated renders). */
  map: TrackerMap;
  /** Number of saved jobs. */
  savedCount: number;
  isSaved: (id: string) => boolean;
  statusOf: (id: string) => JobStatus;
  toggleSave: (id: string) => void;
  setStatus: (id: string, status: JobStatus) => void;
}

export function useTracker(): TrackerApi {
  const map = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isSaved = useCallback((id: string) => map[id]?.saved === true, [map]);
  const statusOf = useCallback(
    (id: string): JobStatus => map[id]?.status ?? "none",
    [map]
  );
  const toggleSave = useCallback(
    (id: string) => setEntry(id, { saved: !(cache[id]?.saved === true) }),
    []
  );
  const setStatus = useCallback(
    (id: string, status: JobStatus) => setEntry(id, { status }),
    []
  );

  const savedCount = useCallback(
    () => Object.values(map).filter((e) => e.saved).length,
    [map]
  )();

  return { map, savedCount, isSaved, statusOf, toggleSave, setStatus };
}
