import clsx from "clsx";
import { DISCIPLINE_MAP } from "@/lib/jobs";
import type { Discipline } from "@/lib/types";

export function DisciplineBadge({
  discipline,
  className,
}: {
  discipline: Discipline;
  className?: string;
}) {
  const meta = DISCIPLINE_MAP[discipline];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset backdrop-blur-sm",
        meta.badge,
        className
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}
