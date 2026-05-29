"use client";

import clsx from "clsx";
import { useState } from "react";
import { companyInitials, DISCIPLINE_MAP, faviconUrl } from "@/lib/jobs";
import type { Discipline } from "@/lib/types";

/**
 * Company identity badge with a guaranteed-safe fallback chain:
 *
 *   1. `logo` URL (if a non-empty string)  →  plain lazy <img>, onError advances
 *   2. Google S2 favicon for a domain guessed from the company name
 *   3. Initials avatar on a discipline-tinted glass circle  ← always renders
 *
 * A broken image is never shown: any load error advances to the next stage,
 * and the initials avatar is the terminal stage.
 */

type Stage = "logo" | "favicon" | "initials";

export function CompanyAvatar({
  company,
  logo,
  discipline,
  size = "md",
  className,
}: {
  company: string | null;
  logo: string | null;
  discipline: Discipline;
  /** sm = card, lg = modal header */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const meta = DISCIPLINE_MAP[discipline];
  const hasLogo = typeof logo === "string" && logo.trim().length > 0;
  const favicon = faviconUrl(company, size === "lg" ? 128 : 64);

  // Initial stage: best available source, falling back forward.
  const firstStage: Stage = hasLogo
    ? "logo"
    : favicon
      ? "favicon"
      : "initials";

  const [stage, setStage] = useState<Stage>(firstStage);
  // Reset the fallback stage when the source identity changes (e.g. the same
  // modal instance is reused for a different job). This is React's documented
  // "adjust state while rendering" pattern — no effect, no cascading render.
  const identity = `${logo ?? ""}|${favicon ?? ""}`;
  const [prevIdentity, setPrevIdentity] = useState(identity);
  if (identity !== prevIdentity) {
    setPrevIdentity(identity);
    setStage(firstStage);
  }

  const dims =
    size === "lg"
      ? "h-14 w-14 text-lg"
      : size === "sm"
        ? "h-9 w-9 text-xs"
        : "h-11 w-11 text-sm";

  const advance = () =>
    setStage((s) => (s === "logo" ? (favicon ? "favicon" : "initials") : "initials"));

  const src =
    stage === "logo" ? (logo as string) : stage === "favicon" ? favicon : null;

  return (
    <span
      className={clsx(
        // discipline-tinted glass circle — also the initials backdrop
        "dod-avatar relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-white/[0.06] font-semibold text-white/90 ring-1 ring-inset ring-white/15",
        meta.avatarTint,
        dims,
        className
      )}
      aria-hidden="true"
    >
      {src ? (
        // Plain <img> by design: logos come from arbitrary remote hosts that
        // aren't in next/image's allowlist, and we need a simple onError chain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={advance}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="select-none leading-none tracking-tight">
          {companyInitials(company)}
        </span>
      )}
    </span>
  );
}
