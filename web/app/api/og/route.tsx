import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

/**
 * Dynamic OG share-card route — a SINGLE query-driven endpoint (not per-page
 * static images) that renders a 1200×630 branded card in DOD's dark/glass look.
 * Every job / company / hub page points its `openGraph.images` at
 * `/api/og?...`, so the build never prerenders thousands of images — cards are
 * generated on-demand at request time and then CDN-cached for a day.
 *
 * ImageResponse runs a tiny flexbox/inline-style subset of CSS (no Tailwind, no
 * external CSS), so all styling here is inline and every multi-child container
 * sets an explicit `display: "flex"`. We deliberately use the default font (no
 * `fonts` option) for v1 so the handler never blocks on a network font fetch.
 * The whole thing is wrapped in try/catch: any failure falls back to a generic
 * "site" card so the endpoint never 500s (a broken OG image breaks link unfurls).
 */

export const runtime = "nodejs";

/* DOD palette (hardcoded — ImageResponse can't read CSS vars / Tailwind). */
const BG = "#06070d";
const SILVER = "rgba(192, 197, 214, 0.30)";
const SILVER_DIM = "rgba(120, 126, 145, 0.22)";
const INK = "#0a0a0b";

/**
 * Discipline accent hexes mirroring DISCIPLINE_MAP's gradients (the `from-*`
 * stop of each topLine). Hardcoded so the route has no lib import that might
 * pull Tailwind/CSS into the edge bundle. Default → violet (the brand hue).
 */
const HUE_ACCENT: Record<string, string> = {
  uiux: "#a78bfa", // violet-400
  product: "#34d399", // emerald-400
  communication: "#fbbf24", // amber-400
  industrial: "#38bdf8", // sky-400
};
const DEFAULT_ACCENT = "#a78bfa";

/** Cache for a day at the CDN + browser; cards are otherwise pure of state. */
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
};

/** Clamp a string to a sane max so a hostile/huge param can't blow up layout. */
function clamp(value: string | null, max: number): string {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * The DOD geometric mark, recreated with plain divs (the SVG in app/icon.svg
 * uses shapes ImageResponse can't render). Two left bars + a dot + a hollow
 * square with a filled corner — a faithful nod to the logo at card scale.
 */
function DodMark({ accent }: { accent: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 64,
        height: 64,
        borderRadius: 16,
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: 40,
          height: 40,
          position: "relative",
        }}
      >
        {/* tall hollow rectangle */}
        <div
          style={{
            display: "flex",
            width: 11,
            height: 30,
            border: `3px solid ${INK}`,
          }}
        />
        {/* thin solid bar */}
        <div
          style={{
            display: "flex",
            width: 4,
            height: 30,
            marginLeft: 3,
            background: INK,
          }}
        />
        {/* accent dot (top-right) */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            right: 0,
            width: 14,
            height: 14,
            borderRadius: 9999,
            background: accent,
          }}
        />
        {/* hollow square with filled corner (bottom-right) */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 16,
            height: 16,
            border: `3px solid ${INK}`,
          }}
        >
          <div style={{ display: "flex", width: 7, height: 7, background: INK }} />
        </div>
      </div>
    </div>
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const kind = searchParams.get("kind") ?? "site";
    const hue = searchParams.get("hue") ?? "";
    const accent = HUE_ACCENT[hue] ?? DEFAULT_ACCENT;

    // Sensible per-kind defaults so a bare ?kind=site still renders a full card.
    const title = clamp(
      searchParams.get("title"),
      kind === "job" ? 90 : 70
    ) || "Live India design jobs";
    const subtitle = clamp(searchParams.get("subtitle"), 80);
    const tag = clamp(searchParams.get("tag"), 32) || "India design jobs";
    const salary = clamp(searchParams.get("salary"), 28);

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: BG,
            padding: 72,
            position: "relative",
            fontFamily: "sans-serif",
          }}
        >
          {/* soft radial color bloom (echoes the site backdrop) */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: -260,
              right: -180,
              width: 760,
              height: 760,
              borderRadius: 9999,
              background: `radial-gradient(circle, ${accent}40, ${accent}14 45%, transparent 70%)`,
            }}
          />
          <div
            style={{
              display: "flex",
              position: "absolute",
              bottom: -300,
              left: -160,
              width: 620,
              height: 620,
              borderRadius: 9999,
              background:
                "radial-gradient(circle, rgba(20,184,166,0.20), rgba(56,189,248,0.08) 45%, transparent 70%)",
            }}
          />

          {/* thin silver border ring */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 24,
              left: 24,
              right: 24,
              bottom: 24,
              borderRadius: 28,
              border: `1px solid ${SILVER}`,
              boxShadow: `inset 0 1px 0 0 rgba(214,219,233,0.10)`,
            }}
          />

          {/* header: DOD mark + wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <DodMark accent={accent} />
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 6,
                color: "#ffffff",
              }}
            >
              DOD
            </div>
          </div>

          {/* tag pill + optional salary chip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 48,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 18px",
                borderRadius: 9999,
                border: `1px solid ${accent}55`,
                background: `${accent}1f`,
                color: "#ffffff",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 12,
                  height: 12,
                  borderRadius: 9999,
                  background: accent,
                }}
              />
              {tag}
            </div>
            {salary ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 18px",
                  borderRadius: 9999,
                  border: "1px solid rgba(52,211,153,0.30)",
                  background: "rgba(16,185,129,0.14)",
                  color: "#a7f3d0",
                  fontSize: 24,
                  fontWeight: 600,
                }}
              >
                {salary}
              </div>
            ) : null}
          </div>

          {/* title — large, clamps to ~2 lines */}
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: title.length > 48 ? 60 : 72,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              color: "#ffffff",
              // keep long titles to ~2 lines
              maxHeight: 200,
              overflow: "hidden",
            }}
          >
            {title}
          </div>

          {/* subtitle */}
          {subtitle ? (
            <div
              style={{
                display: "flex",
                marginTop: 20,
                fontSize: 30,
                fontWeight: 500,
                color: "rgba(255,255,255,0.66)",
              }}
            >
              {subtitle}
            </div>
          ) : null}

          {/* spacer pushes the footer to the bottom */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingTop: 22,
              borderTop: `1px solid ${SILVER_DIM}`,
              fontSize: 24,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            <div style={{ display: "flex", fontWeight: 600, color: "rgba(255,255,255,0.78)" }}>
              dodlovestowork.vercel.app
            </div>
            <div style={{ display: "flex", color: "rgba(255,255,255,0.30)" }}>·</div>
            <div style={{ display: "flex" }}>Live India design jobs</div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: CACHE_HEADERS,
      }
    );
  } catch {
    // Never 500 — a broken OG image breaks every link unfurl. Fall back to a
    // minimal, dependency-free "site" card.
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            background: BG,
            padding: 80,
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 6,
              color: "#ffffff",
            }}
          >
            DOD
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 68,
              fontWeight: 700,
              letterSpacing: -1.5,
              color: "#ffffff",
            }}
          >
            Live India design jobs
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 26,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            dodlovestowork.vercel.app
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: CACHE_HEADERS }
    );
  }
}
