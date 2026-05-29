import Link from "next/link";

/**
 * Compact shared sub-nav for the secondary SSG pages (Companies / Insights /
 * per-company). A server component — the DOD logo mark links home, a tagline,
 * and small nav links. Mirrors the home Header's logo + a11y without pulling in
 * the client board state. `current` dims the active link.
 */
export function PageNav({
  current,
}: {
  current?: "companies" | "insights";
}) {
  return (
    <header className="dod-glass dod-glass--silver relative overflow-hidden rounded-3xl px-5 py-4 sm:px-7 sm:py-5">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="DOD — home"
          className="group inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <svg
            viewBox="0 0 100 100"
            role="img"
            aria-hidden="true"
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <rect width="100" height="100" rx="22" fill="#ffffff" />
            <rect x="22" y="24" width="15" height="40" fill="none" stroke="#0a0a0b" strokeWidth="5" />
            <rect x="41.5" y="24" width="6" height="40" fill="#0a0a0b" />
            <circle cx="71" cy="34" r="12.5" fill="#0a0a0b" />
            <rect x="57" y="53" width="21" height="21" fill="none" stroke="#0a0a0b" strokeWidth="5" />
            <rect x="67" y="63" width="11" height="11" fill="#0a0a0b" />
          </svg>
          <span className="hidden h-6 w-px bg-white/15 sm:block" />
          <span className="hidden text-sm text-white/60 sm:block">
            Live India design jobs
          </span>
          <span className="sr-only">DOD — live India design jobs</span>
        </Link>

        <nav aria-label="Sections" className="flex items-center gap-1.5 text-sm">
          <NavLink href="/companies" active={current === "companies"}>
            Companies
          </NavLink>
          <NavLink href="/insights" active={current === "insights"}>
            Insights
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-full border border-[var(--silver-bright)] bg-white/15 px-3 py-1.5 font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          : "rounded-full border border-[var(--silver-line)] bg-white/[0.04] px-3 py-1.5 font-medium text-white/60 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      }
    >
      {children}
    </Link>
  );
}
