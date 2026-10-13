"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Cross-fade between routes so navigation reads as one continuous site
 * rather than a hard page swap. Concurrent enter/exit (no `mode="wait"`) —
 * blocking the new page until the old one finishes fading out adds a visible
 * stall to every navigation for a transition that is meant to be felt, not
 * noticed.
 *
 * Keyed on `pathname` so App Router's route-level Server Components remount
 * under this Client Component boundary — passing Server Component children
 * through a client wrapper like this is supported; they do not themselves
 * become client components.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
