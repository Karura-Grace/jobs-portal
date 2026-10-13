import Link from "next/link";
import { ShieldCheck, ListChecks, Lock } from "lucide-react";

export const metadata = {
  title: "For talent",
  description:
    "Apply to vetted roles from employers across Africa, and track every application in one place.",
};

const points = [
  {
    icon: ShieldCheck,
    title: "Every listing is reviewed",
    body: "A person checks each role before it publishes. No demo listings, no roles that quietly went stale, no employer who won't say who they are.",
  },
  {
    icon: ListChecks,
    title: "Apply once, track it",
    body: "Keep a CV on file, apply in one step, and see the status of every application move from your dashboard — no wondering if it was even read.",
  },
  {
    icon: Lock,
    title: "Your CV is never public",
    body: "Only the employer for the specific role you applied to can see it — never listed, never searchable, never sold on.",
  },
];

const steps = [
  {
    number: "01",
    title: "Browse what's actually open",
    body: "Every listing here has been checked by a person, not scraped from somewhere else and left to rot.",
  },
  {
    number: "02",
    title: "Apply in one step",
    body: "Attach a CV once. Reuse it for every role after — no re-uploading, no retyping your history.",
  },
  {
    number: "03",
    title: "Watch it move",
    body: "Status updates land in your dashboard and your inbox the moment an employer acts, not weeks of silence.",
  },
];

export default function ForTalentPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <span className="eyebrow">For talent</span>
      <h1 className="mt-3 max-w-2xl font-display text-4xl font-700 leading-[1.08] tracking-display text-ink">
        Your CV deserves better than a black hole.
      </h1>
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
        PAC Africa has placed people for years before this site existed. Every
        role here carries the same standard — checked, current, and answered.
        Browse without an account, or sign in to keep your whole history in
        one place.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {points.map((point) => (
          <div key={point.title} className="clay p-5">
            <div className="clay-raised mb-4 grid h-9 w-9 place-items-center rounded-card">
              <point.icon className="h-4 w-4 text-accent-text" aria-hidden />
            </div>
            <h2 className="font-display text-base font-600 text-ink">{point.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{point.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <span className="eyebrow">How it works</span>
        <div className="mt-5 space-y-4">
          {steps.map((step) => (
            <div key={step.number} className="clay flex gap-4 p-5">
              <span className="font-display text-2xl font-700 text-accent-text/40">
                {step.number}
              </span>
              <div>
                <h3 className="font-display text-base font-600 text-ink">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="clay mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="font-display text-lg font-600 text-ink">
            Ready to look?
          </p>
          <p className="mt-1 text-sm text-muted">
            No account needed to apply — sign up if you want your history saved
            and tracked.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/jobs" className="btn-primary">
            Browse roles
          </Link>
          <Link href="/auth/signup" className="btn-ghost">
            Create account
          </Link>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted">
        Applied through PAC Africa before this site existed?{" "}
        <Link href="/auth/signup" className="text-accent-text hover:underline">
          Sign up
        </Link>{" "}
        with the same email address to reconnect your history.
      </p>
    </div>
  );
}
