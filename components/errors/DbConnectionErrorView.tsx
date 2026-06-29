"use client";

import { isDbConnectionError } from "@/lib/db-connection-error";

type Props = {
  error: Error & { digest?: string; causeDetail?: string };
  reset?: () => void;
};

export function DbConnectionErrorView({ error, reset }: Props) {
  const isDb = isDbConnectionError(error);
  const title = isDb ? "Database connection error" : "Something went wrong";
  const message = isDb
    ? error.message.includes("database") || error.message.includes("MONGODB")
      ? error.message
      : "Could not connect to the database. Check that MongoDB is running and your connection settings are correct."
    : error.message || "Connection error. Please try again.";

  const detail =
    "causeDetail" in error && typeof error.causeDetail === "string"
      ? error.causeDetail
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-ink">
      <div className="w-full max-w-lg rounded-[13px] border border-border bg-surface px-6 py-8 shadow-sm">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-tasks/10 text-tasks">
          <span className="text-lg font-bold" aria-hidden>
            !
          </span>
        </div>
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
        {process.env.NODE_ENV === "development" && detail && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-border bg-surface2 p-3 font-mono text-[10px] leading-relaxed text-faint">
            {detail}
          </pre>
        )}
        {reset && (
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg border border-border bg-surface2 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-faint hover:bg-hover"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
