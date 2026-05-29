"use client";

import clsx from "clsx";
import type { ComponentType, SVGProps } from "react";
import { DISCIPLINES } from "@/lib/jobs";
import type { Discipline } from "@/lib/types";
import {
  CommunicationIcon,
  GridIcon,
  IndustrialIcon,
  ProductIcon,
  UiuxIcon,
} from "./icons";

export type DisciplineFilter = "all" | Discipline;

const ICONS: Record<Discipline, ComponentType<SVGProps<SVGSVGElement>>> = {
  uiux: UiuxIcon,
  product: ProductIcon,
  communication: CommunicationIcon,
  industrial: IndustrialIcon,
};

/**
 * The centerpiece: a responsive row of large gradient category cards that
 * double as the discipline filter. Same public API as the old segmented
 * control (`value` / `counts` / `total` / `onChange`) so the board needs
 * no changes — only the look is transformed.
 */
export function SegmentedControl({
  value,
  counts,
  total,
  onChange,
}: {
  value: DisciplineFilter;
  counts: Record<Discipline, number>;
  total: number;
  onChange: (value: DisciplineFilter) => void;
}) {
  const allActive = value === "all";

  return (
    <div
      role="group"
      aria-label="Filter by discipline"
      className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    >
      {/* "All" — tasteful neutral glass card */}
      <button
        type="button"
        aria-pressed={allActive}
        onClick={() => onChange("all")}
        className={clsx(
          "dod-glass group relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 text-left",
          "transition-all duration-300 ease-out outline-none",
          "focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]",
          allActive
            ? "scale-[1.015] bg-white/[0.12] ring-2 ring-white/40 shadow-[0_12px_44px_-10px_rgba(255,255,255,0.18)]"
            : "opacity-80 hover:opacity-100 hover:bg-white/[0.09]"
        )}
      >
        <div className="flex items-center justify-between">
          <span
            className={clsx(
              "flex h-9 w-9 items-center justify-center rounded-xl text-white/90 transition-colors",
              allActive ? "bg-white/20" : "bg-white/10"
            )}
          >
            <GridIcon className="h-[18px] w-[18px]" />
          </span>
          <span className="text-3xl font-bold tabular-nums text-white sm:text-4xl">
            {total.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="mt-3">
          <span className="text-sm font-semibold text-white">All roles</span>
          <span className="mt-0.5 block text-xs text-white/55">
            Every discipline
          </span>
        </div>
      </button>

      {/* Discipline cards — vivid gradient fills + colored glow */}
      {DISCIPLINES.map((d) => {
        const active = value === d.key;
        const Icon = ICONS[d.key];
        const count = counts[d.key] ?? 0;
        return (
          <button
            key={d.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(d.key)}
            className={clsx(
              "group relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 text-left",
              "border border-white/10",
              "transition-all duration-300 ease-out outline-none",
              "focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b12]",
              d.gradient,
              active
                ? clsx("scale-[1.015] ring-2", d.ring, d.glowShadow)
                : "opacity-70 saturate-[0.8] hover:scale-[1.01] hover:opacity-90 hover:saturate-100"
            )}
          >
            {/* glossy top sheen for tactility */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent"
            />

            <div className="relative flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white shadow-inner">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-3xl font-bold tabular-nums text-white drop-shadow-sm sm:text-4xl">
                {count.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="relative mt-3">
              <span className="text-sm font-semibold text-white drop-shadow-sm">
                {d.label}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-white/75">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                {count === 1 ? "role" : "roles"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
