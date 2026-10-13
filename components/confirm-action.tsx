"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";
import { dash } from "@/lib/content";

/**
 * A destructive or irreversible action behind a confirmation modal.
 *
 * The brief is explicit about this for moderation: "Approve and Reject trigger a
 * confirmation modal before executing. No accidental publishes." Suspension uses
 * the same component, for the same reason.
 *
 * The form and its hidden inputs live inside the modal, so nothing can be
 * submitted without the modal having been opened — the trigger is a button that
 * opens a dialog, not a submit that a stray Enter key can fire. Without
 * JavaScript the fallback is a plain submit, which is the right trade: a
 * confirmation step is a guard against slips, and losing it is better than
 * losing the ability to moderate at all.
 *
 * `reason` turns on a required textarea, which is how Reject gets its
 * "required reason field" without a second component.
 */
export function ConfirmAction({
  action,
  fields,
  trigger,
  triggerClassName = "btn-secondary px-3 py-1.5 text-xs",
  title,
  body,
  confirmLabel,
  tone = "default",
  reason,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Hidden inputs to submit, e.g. `{ job_id: "…", status: "published" }`. */
  fields: Record<string, string>;
  trigger: React.ReactNode;
  triggerClassName?: string;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  reason?: { name: string; label: string; hint?: string; placeholder?: string };
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    lockScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName}
        aria-haspopup="dialog"
      >
        {trigger}
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <motion.button
              type="button"
              aria-label={dash.common.cancel}
              onClick={() => setOpen(false)}
              className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            />

            {/* Modals scale from their centre, not from a trigger — they are not
                anchored to one. */}
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className="clay relative w-full max-w-[420px] p-6 outline-none"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
              transition={
                reduced ? { duration: 0.18 } : { type: "spring", bounce: 0, duration: 0.3 }
              }
            >
              <div className="flex items-start gap-3">
                {tone === "danger" && (
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-accent"
                    aria-hidden
                  />
                )}
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="font-display text-lg font-600 leading-tight text-ink"
                  >
                    {title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </div>

              <form action={action} className="mt-5 space-y-4">
                {Object.entries(fields).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}

                {reason && (
                  <div>
                    <label htmlFor={reason.name} className="eyebrow mb-2 block">
                      {reason.label}
                    </label>
                    <textarea
                      id={reason.name}
                      name={reason.name}
                      rows={3}
                      required
                      minLength={10}
                      placeholder={reason.placeholder}
                      className="field resize-y"
                    />
                    {reason.hint && (
                      <p className="mt-1.5 text-xs text-muted">{reason.hint}</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn-ghost"
                  >
                    {dash.common.cancel}
                  </button>
                  <Confirm label={confirmLabel} tone={tone} />
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function Confirm({ label, tone }: { label: string; tone: "default" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={tone === "danger" ? "btn-primary" : "btn-accent"}
    >
      {pending ? "Working…" : label}
    </button>
  );
}
