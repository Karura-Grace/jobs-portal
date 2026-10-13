import Link from "next/link";
import { BadgeCheck, Inbox, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "For employers",
  description:
    "Post vetted roles on jobs.pac.africa and review applicants from across Africa in one place.",
};

const points = [
  {
    icon: ShieldCheck,
    title: "Every listing is reviewed",
    body: "Nothing goes live automatically — including roles PAC Africa posts itself. That's why applicants take what they find here seriously.",
  },
  {
    icon: Inbox,
    title: "Applicants in one place",
    body: "CVs, cover letters and contact details for every role you post, with shortlisting, status tracking, and internal notes — no spreadsheet required.",
  },
  {
    icon: BadgeCheck,
    title: "Verified employer badge",
    body: "Once we've confirmed who you are, your listings carry a badge that visibly separates you from the noise on other boards.",
  },
];

const steps = [
  {
    number: "01",
    title: "Post the role",
    body: "Write it once — title, level, location, what you're actually looking for.",
  },
  {
    number: "02",
    title: "We check it",
    body: "An admin reviews before it publishes. It goes live once it's real and complete, not before.",
  },
  {
    number: "03",
    title: "Review who applies",
    body: "Applicants land in your dashboard as they come in. Shortlist, move a status, or pass — the applicant sees it either way.",
  },
];

export default function EmployersPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <span className="eyebrow">For employers</span>
      <h1 className="mt-3 max-w-2xl font-display text-4xl font-700 leading-[1.08] tracking-display text-ink">
        Hire from a pool that's already been checked.
      </h1>
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
        PAC Africa has placed people across the continent for years — this is
        the same standard, self-serve. An employer account lets you publish
        roles, review applicants, and manage your company profile without
        waiting on an introduction.
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
            Already have an employer account?
          </p>
          <p className="mt-1 text-sm text-muted">
            Sign in and post your role. New accounts can be created in a minute.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/auth/signup" className="btn-primary">
            Create employer account
          </Link>
          <Link href="/auth/login" className="btn-ghost">
            Sign in
          </Link>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted">
        Signed in as a job seeker and need to hire instead? Write to{" "}
        <a href="mailto:hello@pac.africa" className="text-accent-text hover:underline">
          hello@pac.africa
        </a>{" "}
        and we will switch your account over.
      </p>
    </div>
  );
}
