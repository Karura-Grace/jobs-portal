"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { dash } from "@/lib/content";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";

/**
 * Slide-out detail panel (brief §9).
 *
 * URL-driven: the parent page reads a search param and renders the drawer's
 * contents on the server, so a drawer is linkable, survives a refresh, and the
 * back button closes it. That also means the panel's data is fetched with the
 * page rather than in a client effect — no spinner inside the drawer.
 *
 * MOTION. Spring from the right, per the brief. Apple's move preset —
 * critically damped, ~0.4s response — because there is no gesture carrying
 * momentum into this, so overshoot would be decoration rather than physics. The
 * scrim cross-fades on its own timing; a spring on opacity would look uncertain.
 *
 * Under prefers-reduced-motion the panel cross-fades in place instead of
 * travelling: same information, no vestibular movement.
 *
 * Closing is deliberately routed through `router.back()` when this drawer was
 * opened by a navigation, so Escape, the close button, the scrim and the browser
 * back button all do the same thing.
 */
export function Drawer({
  open,
  closeHref,
  title,
  children,
  footer,
}: {
  open: boolean;
  /** Where the page sits with the drawer shut. */
  closeHref: string;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    returnFocusTo.current = document.activeElement;
    // Focus the panel itself rather than the first control: a screen reader then
    // announces the heading, and Tab still lands on the first interactive thing.
    panelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", onKey);

    // The page behind must not scroll while a modal panel is open.
    lockScroll();

    return () => {
      document.removeEventListener("keydown", onKey);
      unlockScroll();
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, closeHref, router]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          {/* Scrim. A modal task, so the background is dimmed and pushed back
              rather than left live. */}
          <motion.button
            type="button"
            aria-label={dash.drawer.closeLabel}
            onClick={() => router.push(closeHref, { scroll: false })}
            className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="relative flex h-full w-full max-w-[520px] flex-col border-l border-line bg-surface shadow-clay-lifted outline-none"
            initial={reduced ? { opacity: 0 } : { x: "100%" }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "100%" }}
            transition={
              reduced
                ? { duration: 0.2 }
                : { type: "spring", bounce: 0, duration: 0.4 }
            }
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <h2 className="min-w-0 font-display text-lg font-600 leading-tight text-ink">
                {title}
              </h2>
              <button
                type="button"
                onClick={() => router.push(closeHref, { scroll: false })}
                aria-label={dash.drawer.closeLabel}
                className="press grid h-8 w-8 shrink-0 place-items-center rounded-pill text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              {children}
            </div>

            {footer && (
              <div className="border-t border-line bg-surface px-5 py-4">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
