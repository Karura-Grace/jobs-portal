"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Script from "next/script";
import { useTheme } from "next-themes";

/**
 * The captcha in front of sign-in and sign-up.
 *
 * Supabase verifies the token server-side (Authentication → Attack Protection),
 * so all this has to do is obtain one and hand it to `signInWithPassword` /
 * `signUp`. If captcha is enabled there and no token is sent, Supabase rejects
 * the request — which means enabling it in the dashboard without this component
 * takes sign-in down.
 *
 * TURNSTILE ONLY. Supabase also supports hCaptcha, but this project settled on
 * Turnstile, so the hCaptcha branch that used to live here was removed along
 * with the @hcaptcha/react-hcaptcha dependency. The Supabase dashboard's
 * Attack Protection provider must be set to Turnstile to match, or every
 * attempt fails with "invalid-input-response" — see the mapped error message
 * in lib/auth-errors.ts.
 *
 * THE TOKEN IS SINGLE USE. A failed sign-in consumes it, so the widget has to be
 * reset before the next attempt or the second try fails for a different reason
 * than the first. That is what the imperative `reset()` is for, and both forms
 * call it on every error.
 *
 * Unconfigured (no site key) renders nothing and yields no token, so local
 * development against a project with captcha off keeps working.
 */

export type CaptchaHandle = { reset: () => void };

const SITE_KEY = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY ?? "";

/** Whether a token should be expected at all. Read by the forms. */
export const captchaConfigured = SITE_KEY.length > 0;

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: Record<string, unknown>
      ) => string | undefined;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

export const Captcha = forwardRef<
  CaptchaHandle,
  { onToken: (token: string | null) => void }
>(function Captcha({ onToken }, ref) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";

  // ── Turnstile ────────────────────────────────────────────────
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [scriptReady, setScriptReady] = useState(false);
  // Kept in a ref so the render effect does not re-run — and re-render the
  // widget — every time the parent re-renders with a new callback identity.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  const renderTurnstile = useCallback(() => {
    if (!holder.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(holder.current, {
      sitekey: SITE_KEY,
      theme,
      callback: (token: string) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    });
  }, [theme]);

  useEffect(() => {
    if (!captchaConfigured || !scriptReady) return;
    renderTurnstile();
    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = undefined;
      }
    };
  }, [scriptReady, renderTurnstile]);

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current(null);
      if (window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }));

  if (!captchaConfigured) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={holder} className="flex justify-center" />
    </>
  );
});
