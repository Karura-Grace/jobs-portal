"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
      <div className="clay flex w-full max-w-md flex-col items-center px-8 py-12">
        <AlertTriangle className="h-7 w-7 text-accent-text" aria-hidden />
        <p className="mt-4 font-display text-lg font-600 text-ink">
          Something went wrong
        </p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          The page failed to load. Please try again — if it keeps happening,
          let us know.
        </p>
        {process.env.NODE_ENV === "development" && (
          <p className="mt-4 max-w-full overflow-x-auto rounded-card bg-black/5 px-3 py-2 text-left text-xs text-muted dark:bg-white/5">
            {error.message}
            {error.digest && ` (${error.digest})`}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button onClick={reset} className="btn-accent">
            Try again
          </button>
          <a href="mailto:hello@pac.africa" className="btn-secondary">
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
