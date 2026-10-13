"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Catches errors thrown by the root layout itself — the one place `error.tsx`
 * cannot help, since a broken layout takes any nested error boundary down
 * with it. Sentry's docs are explicit that this file must render its own
 * <html>/<body>: there is no surviving layout left to rely on.
 */
export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-white px-6 text-center font-sans text-[#0A0A0A]">
        <div className="max-w-md rounded-2xl border border-black/10 bg-white px-8 py-10 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)]">
          <p className="text-lg font-semibold">Something went wrong</p>
          <p className="mt-2 text-sm text-black/60">
            The page failed to load. Please try again — if it keeps
            happening, let us know.
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="mt-4 break-words rounded-lg bg-black/5 px-3 py-2 text-left text-xs text-black/60">
              {error.message}
              {error.digest && ` (${error.digest})`}
            </p>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={reset}
              className="rounded-full bg-[#E8532E] px-5 py-2.5 text-sm font-medium text-[#0A0A0A]"
            >
              Try again
            </button>
            <a
              href="mailto:hello@pac.africa"
              className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-black/70"
            >
              Contact support
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
