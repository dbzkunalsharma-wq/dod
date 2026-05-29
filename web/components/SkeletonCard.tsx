export function SkeletonCard() {
  return (
    <div
      className="dod-glass dod-shimmer flex flex-col rounded-2xl p-5"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 rounded-full bg-white/10" />
        <div className="h-3 w-10 rounded bg-white/10" />
      </div>
      <div className="mt-4 h-5 w-3/4 rounded bg-white/10" />
      <div className="mt-2 h-4 w-1/2 rounded bg-white/[0.07]" />
      <div className="mt-4 h-3 w-2/3 rounded bg-white/[0.07]" />
      <div className="mt-6 h-10 w-full rounded-xl bg-white/[0.07]" />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
