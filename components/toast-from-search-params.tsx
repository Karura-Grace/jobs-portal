"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Fires a toast for a server action's `?error=`/`?success=` redirect result.
 * The message comes from the server action that actually ran, not from
 * optimistic client state.
 *
 * Renders nothing itself; `<Toaster />` in app/layout.tsx renders the toast.
 */
export function ToastFromSearchParams({
  error,
  success,
}: {
  error?: string | null;
  success?: string | null;
}) {
  // Search params are stable across a client-side re-render of the same
  // navigation, so without this a toast already dismissed by its own timer
  // would never re-fire — but the ref must not survive an actual navigation
  // to a new error/success value.
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const message = error ?? success ?? null;
    if (!message || shown.current === message) return;
    shown.current = message;
    if (error) {
      toast.error(error);
    } else if (success) {
      toast.success(success);
    }
  }, [error, success]);

  return null;
}
