"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, safeNextPath } from "@/lib/utils";
import { authErrorMessage } from "@/lib/auth-errors";
import { isBlockedEmployerEmail } from "@/lib/employer-email";
import { Captcha, captchaConfigured, type CaptchaHandle } from "@/components/captcha";

const PASSWORD_RULES = [
  { label: "10 characters", test: (v: string) => v.length >= 10 },
  { label: "1 capital letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "1 number", test: (v: string) => /[0-9]/.test(v) },
  { label: "1 special symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;
import type { UserRole } from "@/types/database";

/**
 * Signup. Brief §7 sends every gated action here as
 * /auth/signup?next=[path], so the visitor lands back where they started.
 *
 * `next` is validated through safeNextPath — it arrives from the URL, so an
 * unchecked value would make this an open redirect.
 */
export function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"), "/dashboard");

  const [role, setRole] = useState<UserRole>("seeker");
  // Prefilled from the application-received email's signup link, so a guest
  // applicant doesn't have to retype the address their application is filed under.
  const [form, setForm] = useState({
    name: "",
    email: params.get("email") ?? "",
    password: "",
    passwordConfirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);

  const passwordValid = PASSWORD_RULES.every((rule) => rule.test(form.password));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!passwordValid) {
      setError("Please meet all the password requirements below.");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    if (role === "employer" && isBlockedEmployerEmail(form.email)) {
      setError("Please sign up with your work email address rather than a personal one.");
      return;
    }

    if (captchaConfigured && !captchaToken) {
      setError("Please complete the security check first.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.name, role },
        // The trigger whitelists `role` to seeker/employer regardless of what
        // is sent here (migration 003) — this is a convenience, not a grant.
        ...(captchaToken ? { captchaToken } : {}),
      },
    });

    if (signUpError) {
      setError(authErrorMessage(signUpError.message));
      setLoading(false);
      // Single-use token, already spent by the failed attempt.
      captcha.current?.reset();
      setCaptchaToken(null);
      return;
    }

    // The profiles row comes from the on_auth_user_created trigger, which also
    // whitelists the role — a client cannot grant itself admin here.
    // Email confirmation is on deliberately: migration 006 treats a confirmed
    // address as proof of ownership before releasing application history.
    if (!data.session) {
      setAwaitingConfirmation(true);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  if (awaitingConfirmation) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <div className="clay p-8">
          <span className="eyebrow">One more step</span>
          <h1 className="mt-2 font-display text-3xl font-700 tracking-display text-ink">
            Check your email
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            We sent a confirmation link to{" "}
            <span className="font-medium text-ink">{form.email}</span>. Open it to
            activate your account.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            If you have applied for a role through PAC Africa before, confirming
            this address is also what reconnects your earlier applications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="clay p-8">
        <span className="eyebrow">Join PAC Jobs</span>
        <h1 className="mt-2 mb-8 font-display text-3xl font-700 tracking-display text-ink">
          Create account
        </h1>

        <div className="mb-6 flex gap-2">
          <RoleButton
            active={role === "seeker"}
            onClick={() => setRole("seeker")}
            label="I'm looking for work"
          />
          <RoleButton
            active={role === "employer"}
            onClick={() => setRole("employer")}
            label="I'm hiring"
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            aria-label={role === "employer" ? "Company contact name" : "Full name"}
            placeholder={role === "employer" ? "Company contact name" : "Full name"}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="field"
          />
          <input
            required
            type="email"
            aria-label="Email address"
            placeholder="Email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="field"
          />
          {role === "seeker" && (
            <p className="px-1 text-xs text-muted">
              Applied through PAC Africa before? Confirming this address
              automatically reconnects your earlier applications.
            </p>
          )}
          <input
            required
            type="password"
            aria-label="Password"
            placeholder="Password"
            minLength={10}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="field"
          />

          {form.password.length > 0 && (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 px-1">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(form.password);
                return (
                  <li
                    key={rule.label}
                    className={cn(
                      "flex items-center gap-1.5 text-xs",
                      met ? "text-accent-text" : "text-muted"
                    )}
                  >
                    <Check className={cn("h-3 w-3 shrink-0", !met && "opacity-30")} aria-hidden />
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          )}

          <input
            required
            type="password"
            aria-label="Confirm password"
            placeholder="Confirm password"
            minLength={10}
            value={form.passwordConfirm}
            onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
            className="field"
          />

          <Captcha ref={captcha} onToken={setCaptchaToken} />

          <button type="submit" disabled={loading} className="btn-accent w-full">
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-xs text-muted">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="text-accent-text hover:underline">
              Terms of service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-accent-text hover:underline">
              Data &amp; cookies
            </Link>{" "}
            policy.
          </p>

          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </form>

        <p className="mt-6 text-sm text-muted">
          Already have an account?{" "}
          <Link
            href={`/auth/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-accent-text hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function RoleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press flex-1 rounded-card px-3 py-2.5 text-xs font-medium transition-colors duration-150 ease-out",
        active
          ? "bg-accent/10 text-accent-text ring-1 ring-accent/40"
          : "text-muted hover:text-ink"
      )}
      style={active ? undefined : { boxShadow: "var(--clay-shadow-inset)" }}
    >
      {label}
    </button>
  );
}
