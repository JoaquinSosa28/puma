"use client";

import { useEffect } from "react";
import { DbConnectionErrorView } from "@/components/errors/DbConnectionErrorView";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <DbConnectionErrorView error={error} reset={reset} />;
}
