import { resolveMx } from "node:dns/promises";

/* ------------------------------------------------------------------ */
/*  Domain mailability check (server-only — uses node:dns)             */
/*                                                                     */
/*  The outreach model derives `careers@`/`hr@`-style addresses from a  */
/*  GUESSED company domain (e.g. "Google India" → googleindia.com).     */
/*  Many of those guesses don't resolve or can't receive mail, so this  */
/*  module asks DNS which domains actually publish MX records and lets   */
/*  callers drop the dead ones. It must NEVER throw and must NEVER hang: */
/*  every lookup races a hard timeout, any error/timeout/ENODATA is      */
/*  treated as "not mailable", and the whole batch is bounded by a       */
/*  small concurrency pool. Importing this into a Client Component will  */
/*  fail the build (node:dns is server-only) — that's intentional.       */
/* ------------------------------------------------------------------ */

/** Per-domain DNS timeout. Generous enough for real resolvers, short
 *  enough that a hung/slow lookup can't stall the build. */
const LOOKUP_TIMEOUT_MS = 2500;

/** Max concurrent DNS lookups in flight (a simple promise pool, no deps). */
const CONCURRENCY = 24;

/**
 * Resolve a single domain's MX records, racing a hard timeout. Resolves to
 * `true` iff DNS returns at least one MX record with a non-empty exchange host
 * within the timeout (a lone empty-exchange "null MX" per RFC 7505 means the
 * domain accepts no mail and reads as `false`). Any failure mode — ENOTFOUND,
 * ENODATA, NXDOMAIN, SERVFAIL, timeout, or any thrown error — resolves to
 * `false`. Never rejects.
 */
async function isMailable(domain: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), LOOKUP_TIMEOUT_MS);
    });
    const lookup = resolveMx(domain)
      .then(
        (records) =>
          // Need ≥1 MX with a real exchange host. A single empty-exchange
          // record is a "null MX" (RFC 7505): the domain EXPLICITLY accepts no
          // mail (e.g. googleindia.com), so it must read as NOT mailable.
          Array.isArray(records) &&
          records.some((r) => typeof r?.exchange === "string" && r.exchange.trim().length > 0)
      )
      .catch(() => false);
    return await Promise.race([lookup, timeout]);
  } catch {
    // resolveMx can throw synchronously on a malformed hostname.
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Given a list of candidate domains, return the subset that actually accept
 * mail (≥1 MX record with a real exchange host), lowercased. Input is de-duped
 * + lowercased and
 * empties are dropped before lookups. Runs lookups through a bounded promise
 * pool so a large feed can't open hundreds of sockets at once. Deterministic
 * for a fixed DNS view, and guaranteed to terminate (each lookup is timed).
 *
 * Safe by construction: if DNS is entirely unavailable (e.g. a build sandbox
 * with no outbound DNS), every lookup fails and this returns an empty Set —
 * callers then suppress all guessed emails, which is conservative but correct.
 */
export async function mailableDomains(
  domains: string[]
): Promise<Set<string>> {
  // Dedupe + normalise; drop blanks.
  const unique = Array.from(
    new Set(
      domains
        .map((d) => (typeof d === "string" ? d.trim().toLowerCase() : ""))
        .filter((d) => d.length > 0)
    )
  );

  const mailable = new Set<string>();
  if (unique.length === 0) return mailable;

  let cursor = 0;

  // One pool worker: pull the next index until the list is exhausted.
  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= unique.length) return;
      const domain = unique[index];
      const ok = await isMailable(domain);
      if (ok) mailable.add(domain);
    }
  }

  const workerCount = Math.min(CONCURRENCY, unique.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return mailable;
}
