export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 pt-2 animate-pulse" aria-busy="true">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2 border-b border-surface-container-high pb-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-surface-container" />
          <div className="h-8 w-56 rounded-md bg-surface-container-high" />
          <div className="h-4 w-72 rounded bg-surface-container" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-9 w-32 rounded-full bg-surface-container" />
          <div className="h-9 w-28 rounded-full bg-surface-container" />
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex h-28 items-center gap-4 rounded-xl border border-hairline bg-surface-container-lowest p-5 shadow-sm"
          >
            <div className="size-12 rounded-xl bg-surface-container" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 rounded bg-surface-container" />
              <div className="h-7 w-28 rounded bg-surface-container-high" />
              <div className="h-3 w-16 rounded bg-surface-container" />
            </div>
          </div>
        ))}
      </div>

      {/* 2-Column Dashboard Body */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <div className="h-64 rounded-2xl border border-hairline bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-4 h-5 w-40 rounded bg-surface-container" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-12 w-full rounded-lg bg-surface-container-low" />
              ))}
            </div>
          </div>
          <div className="h-64 rounded-2xl border border-hairline bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-4 h-5 w-40 rounded bg-surface-container" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-12 w-full rounded-lg bg-surface-container-low" />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="h-64 rounded-2xl border border-hairline bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-4 h-5 w-40 rounded bg-surface-container" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-12 w-full rounded-lg bg-surface-container-low" />
              ))}
            </div>
          </div>
          <div className="h-64 rounded-2xl border border-hairline bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-4 h-5 w-40 rounded bg-surface-container" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-12 w-full rounded-lg bg-surface-container-low" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

