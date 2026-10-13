"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { job as jobCopy } from "@/lib/content";

/**
 * Share, with a copy-link fallback (brief §6).
 *
 * navigator.share only exists on mobile and in secure contexts, and it rejects
 * when the user dismisses the sheet — which is not an error worth surfacing. So
 * the share attempt is tried first and copying is the fallback, including when
 * the sheet is cancelled.
 */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed or unsupported — fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context, or permission denied). Nothing
      // useful to say, and an error toast here would be noise.
    }
  }

  return (
    <button type="button" onClick={share} className="btn-secondary w-full text-xs">
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden />
          {jobCopy.shareCopied}
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          {jobCopy.share}
        </>
      )}
    </button>
  );
}
