"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "cookie-notice-dismissed";

/**
 * Not a consent manager — there's nothing non-essential to opt into. Per
 * app/privacy/page.tsx, an anonymous visit sets no cookies at all, and the
 * only cookie that ever exists is the strictly-necessary session cookie set
 * on sign-in, which doesn't require consent under GDPR/ePrivacy. This is
 * purely a disclosure, dismissed once and remembered locally.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl md:inset-x-auto md:right-4">
      <div className="clay flex flex-col gap-3 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted">
          We only set a cookie when you sign in, to keep you signed in — no tracking or
          advertising cookies.{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
            Learn more
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="btn-primary shrink-0 px-4 py-2 text-xs"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
