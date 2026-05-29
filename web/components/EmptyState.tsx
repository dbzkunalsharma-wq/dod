import { BookmarkIcon, EmptyIcon } from "./icons";

export function EmptyState({
  onReset,
  savedView = false,
}: {
  onReset?: () => void;
  /** Tailor the copy when the user is viewing their (empty) saved list. */
  savedView?: boolean;
}) {
  return (
    <div className="dod-glass dod-glass--silver col-span-full flex flex-col items-center justify-center rounded-3xl px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
        {savedView ? (
          <BookmarkIcon className="h-7 w-7 text-white/45" />
        ) : (
          <EmptyIcon className="h-7 w-7 text-white/45" />
        )}
      </span>
      <h3 className="mt-4 text-base font-semibold text-white">
        {savedView ? "No saved roles yet" : "No roles match your filters"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-white/50">
        {savedView
          ? "Tap the bookmark on any role to save it here for later — your list is kept on this device."
          : "Try a different discipline, clear your search, or widen the source filter — new roles land here continuously."}
      </p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
