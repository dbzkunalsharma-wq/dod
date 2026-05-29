"use client";

import { useSyncExternalStore } from "react";
import { relativeTime } from "./jobs";

/**
 * A tiny external store that ticks on an interval. Components subscribe via
 * `useSyncExternalStore`, which gives us a clean way to render *time-dependent*
 * values that differ between server and client without a setState-in-effect.
 *
 * - The server snapshot is always `null` (no stable "now" on the server), so
 *   SSR renders a placeholder and hydration matches.
 * - The client snapshot returns the current epoch ms, recomputed every tick.
 */

const INTERVAL_MS = 30_000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let snapshot = 0; // epoch ms, refreshed each tick

function ensureTimer() {
  if (timer === null) {
    snapshot = Date.now();
    timer = setInterval(() => {
      snapshot = Date.now();
      for (const l of listeners) l();
    }, INTERVAL_MS);
  }
}

function subscribe(listener: () => void): () => void {
  ensureTimer();
  listeners.add(listener);
  // refresh immediately on (re)subscribe so a freshly mounted consumer is current
  snapshot = Date.now();
  listener();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getClientSnapshot = () => snapshot;
const getServerSnapshot = () => 0;

/** Returns a live "now" (epoch ms) on the client, or `null` during SSR. */
export function useNow(): number | null {
  const now = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  return now === 0 ? null : now;
}

/** Convenience: a live relative-time string, or `null` until hydrated. */
export function useRelativeTime(value: string | null | undefined): string | null {
  const now = useNow();
  if (now === null || !value) return null;
  return relativeTime(value, now);
}
