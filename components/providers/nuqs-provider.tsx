"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <ConfirmProvider>{children}</ConfirmProvider>
    </NuqsAdapter>
  );
}
