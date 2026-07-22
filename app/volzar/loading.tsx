// Route-level loading UI: the page is force-dynamic and does auth + a
// (TTL-throttled) Metafy tier re-verify before first byte, so navigation can
// hang on an external round-trip. Mirror the page shell so there's no layout
// jump when the real chat swaps in.
export default function VolzarLoading() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-9.5rem-1px-env(safe-area-inset-bottom))] min-h-[24rem] w-full max-w-[1800px] flex-col px-2 pb-1 pt-2 sm:h-[calc(100dvh-7.125rem)] sm:px-4">
      <div className="flex flex-col gap-3 flex-1 min-h-0" aria-busy="true" aria-label="Loading Volzar">
        {/* header row: avatar + title */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-8 w-24 animate-pulse rounded-md bg-muted" />
        </div>
        {/* quick-action chip strip */}
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
        {/* transcript area */}
        <div className="flex-1 min-h-0 rounded-lg border border-border bg-card/40" />
        {/* composer */}
        <div className="flex items-end gap-2">
          <div className="h-16 flex-1 animate-pulse rounded-md bg-muted" />
          <div className="h-11 w-24 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}
