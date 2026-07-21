"use client";

/**
 * Phone header: just the brand row. Navigation lives in the floating dock
 * (MobileDock) and the More sheet — the old hamburger drawer is gone.
 */
export function MobileShell(_props: { sidebar?: React.ReactNode }) {
  return (
    <div className="lg:hidden">
      <div
        className="mb-3 flex shrink-0 items-center gap-2.5"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-[13px] font-extrabold text-background">
          P
        </span>
        <span className="text-[15px] font-extrabold tracking-tight">P.U.M.A</span>
      </div>
    </div>
  );
}
