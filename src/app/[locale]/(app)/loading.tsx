export default function AppLoading() {
  return (
    <div className="flex w-full flex-col gap-6 pt-2 animate-pulse" aria-busy="true">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2 border-b border-surface-container-high pb-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-surface-container" />
          <div className="h-8 w-64 rounded-md bg-surface-container-high" />
          <div className="h-4 w-80 rounded bg-surface-container" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-full bg-surface-container" />
          <div className="h-9 w-28 rounded-full bg-surface-container" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex h-28 items-center gap-4 rounded-xl border border-hairline bg-surface-container-lowest p-5 shadow-sm"
          >
            <div className="size-12 rounded-xl bg-surface-container" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-surface-container" />
              <div className="h-6 w-3/4 rounded bg-surface-container-high" />
            </div>
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="h-80 w-full rounded-2xl border border-hairline bg-surface-container-lowest p-6 shadow-sm">
        <div className="mb-4 h-5 w-48 rounded bg-surface-container" />
        <div className="space-y-3">
          <div className="h-10 w-full rounded-lg bg-surface-container-low" />
          <div className="h-10 w-full rounded-lg bg-surface-container-low" />
          <div className="h-10 w-full rounded-lg bg-surface-container-low" />
          <div className="h-10 w-full rounded-lg bg-surface-container-low" />
        </div>
      </div>
    </div>
  );
}

