"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { replayTutorial } from "@/lib/actions/settings";
import { toast } from "sonner";

/**
 * Watch the tour again. Clearing the marker re-arms the overlay, which lives
 * in the app layout — so the refresh below is what actually brings it back.
 */
export function ReplayTutorialButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await replayTutorial();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          router.push("/");
          router.refresh();
        })
      }
      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-faint disabled:opacity-50"
    >
      <Play className="h-3.5 w-3.5 fill-current" />
      {pending ? "Rolling…" : "Play the 60-second tour again"}
    </button>
  );
}
