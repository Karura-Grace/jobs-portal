"use client";

import { useEffect } from "react";

/**
 * Browsers default history.scrollRestoration to "auto", which reapplies a
 * leftover scroll offset on reload/back-forward navigation. That offset is
 * enough to trip PublicNav's scroll-past-60px compact state on load,
 * cropping the hero even though the page looks like it's "at the top".
 */
export function ScrollRestoration() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  return null;
}
