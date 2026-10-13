import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { site } from "@/lib/content";

export const metadata = { title: "Account suspended" };

/**
 * Where a suspended account lands. Deliberately plain and not accusatory: most
 * suspensions are a duplicate account or a listing dispute, and the person
 * reading this needs to know who to talk to, not to be told off.
 *
 * Signing out is offered rather than forced — clearing the session would make
 * "contact us from the address on the account" harder to act on.
 */
export default function SuspendedPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <ShieldAlert className="mx-auto mb-5 h-8 w-8 text-accent" aria-hidden />
      <h1 className="font-display text-2xl font-700 tracking-display text-ink">
        This account is on hold
      </h1>
      <p className="mx-auto mt-3 text-sm leading-relaxed text-muted">
        {site.owner} has paused it, so applying and posting are switched off for now.
        Nothing has been deleted — your applications and CV are untouched.
      </p>
      <p className="mx-auto mt-3 text-sm leading-relaxed text-muted">
        Email{" "}
        <a href="mailto:hello@pac.africa" className="text-accent-text hover:opacity-70">
          hello@pac.africa
        </a>{" "}
        from the address on the account and we will sort it out.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/jobs" className="btn-primary">
          Browse roles
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn-ghost">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
