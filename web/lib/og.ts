import type { Discipline } from "./types";

/**
 * Build a relative `/api/og?...` URL for the dynamic share-card route. Every
 * param is `encodeURIComponent`-encoded here so callers pass raw strings.
 * Empty / nullish params are dropped so the route falls back to its defaults.
 *
 * Next resolves this relative URL against `metadataBase`
 * (https://dodlovestowork.vercel.app) when it renders `<meta og:image>`, so the
 * emitted tag is absolute and unfurls correctly off-site.
 */
export interface OgParams {
  kind: "job" | "company" | "site";
  title: string;
  subtitle?: string | null;
  tag?: string | null;
  salary?: string | null;
  hue?: Discipline | null;
}

export function ogImageUrl(params: OgParams): string {
  const sp = new URLSearchParams();
  sp.set("kind", params.kind);
  if (params.title) sp.set("title", params.title);
  if (params.subtitle) sp.set("subtitle", params.subtitle);
  if (params.tag) sp.set("tag", params.tag);
  if (params.salary) sp.set("salary", params.salary);
  if (params.hue) sp.set("hue", params.hue);
  // URLSearchParams already percent-encodes values (incl. spaces as "+", which
  // Next/decode handles). Use it directly for a stable, correct query string.
  return `/api/og?${sp.toString()}`;
}
