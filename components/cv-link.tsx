"use client";

import { useState, useTransition } from "react";
import { FileText, Clock, Loader2 } from "lucide-react";
import type { CvLink as CvLinkValue } from "@/lib/cv";

/**
 * One rendering of a CV link, used by the admin browser, the employer applicant
 * view and the seeker profile.
 *
 * The signed URL is not fetched until the click: `onOpen` is a server action
 * bound to this specific row, called only here, so a page listing 50
 * applications never signs 50 files nobody asked to see. The link is good for
 * 25 minutes from the click (see lib/cv-access.ts), not from when the page
 * rendered — previously the countdown started at render, so a link could
 * (and often did) expire before anyone clicked it.
 *
 * "supabase" and "r2" both open identically — which backend holds the file is
 * our problem, not theirs.
 *
 * "legacy" is deliberately NOT a link. Those cv_urls point at
 * https://jobs.pac.africa/wp-content/uploads/... and return 403, because the
 * domain now resolves to Vercel rather than the old WordPress host. The files
 * are not lost — they are in the recovered archive, waiting on
 * scripts/migrate-cvs.mjs. Offering a link that cannot work reads as a broken
 * product; saying so plainly tells whoever is looking that nothing was lost.
 */
export function CvLink({
  status,
  onOpen,
  compact = false,
}: {
  status: "none" | "legacy" | "ready";
  onOpen?: () => Promise<CvLinkValue>;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "none") {
    return <span className="text-xs text-pac-faint">No CV attached</span>;
  }

  if (status === "legacy") {
    return (
      <span
        title="Held in the archive recovered from the previous site. Unreachable at its old address since the domain moved — pending migration into our own storage."
        className="inline-flex items-center gap-1.5 text-xs text-pac-muted"
      >
        <Clock className="w-3.5 h-3.5" aria-hidden />
        CV pending migration
      </span>
    );
  }

  function handleClick() {
    setError(null);
    // Opened synchronously, inside the click's own call stack — a browser's
    // popup blocker only allows window.open() during a real user gesture, and
    // that allowance can expire while `onOpen` is still awaiting the sign.
    // Opening blank now and navigating once the link is ready keeps the tab.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null; // sever the back-reference before it ever holds a location

    startTransition(async () => {
      const result = await onOpen?.();
      if (result?.kind === "supabase" || result?.kind === "r2") {
        if (tab) {
          tab.location.href = result.href;
        } else {
          // Popup blocked outright — nothing was open to navigate. Try once
          // more directly; if this is also blocked, there is nothing left to do.
          window.open(result.href, "_blank", "noopener,noreferrer");
        }
      } else if (result?.kind === "legacy") {
        setError("Pending migration");
        tab?.close();
      } else {
        setError("Link unavailable");
        tab?.close();
      }
    });
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title="Signs a private link good for 25 minutes"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-pac-orange-dark hover:underline disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
        ) : (
          <FileText className="w-3.5 h-3.5" aria-hidden />
        )}
        {pending ? "Preparing…" : "Open CV"}
        {!compact && !pending && (
          <span className="font-normal text-pac-muted">— link expires in 25 min</span>
        )}
      </button>
      {error && (
        <span role="alert" className="text-xs text-pac-muted">
          {error}
        </span>
      )}
    </span>
  );
}
