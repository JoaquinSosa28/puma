/**
 * Route-level skeleton: lets the shell paint immediately while the page's data
 * batch resolves (matters over high-latency links). Mirrors the page area only —
 * the sidebar/omnibar come from the layout, which renders around this.
 */
export default function AppLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-6 animate-pulse">
      <div className="flex items-center justify-between pt-1">
        <div className="h-8 w-44 rounded-lg bg-surface2" />
        <div className="h-8 w-56 rounded-lg bg-surface2" />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-40 rounded-[13px] border border-border bg-surface2/60"
          />
        ))}
      </div>
    </div>
  );
}
