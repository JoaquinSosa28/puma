import { LeaveDemoButton } from "@/components/shell/LeaveDemoButton";

/** Slim strip shown to demo accounts: this data is fictional and temporary. */
export function DemoBanner({ expiresAt }: { expiresAt: string | null }) {
  const hoursLeft = expiresAt
    ? Math.max(1, Math.round((Date.parse(expiresAt) - Date.now()) / 3_600_000))
    : null;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-[10px] border border-primary/25 bg-primary/[0.06] px-3 py-1.5 text-center">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
        Demo account
      </span>
      <span className="text-[12px] text-muted">
        Sample data{hoursLeft ? ` · resets in ~${hoursLeft}h` : " · temporary"}.
      </span>
      <LeaveDemoButton />
    </div>
  );
}
