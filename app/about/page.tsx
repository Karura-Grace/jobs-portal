import Link from "next/link";
import { Target, ShieldCheck, Globe2 } from "lucide-react";
import { site } from "@/lib/content";

export const metadata = {
  title: "About",
  description:
    "Why PAC Africa runs a job board, and how listings and applicants get vetted before they meet.",
};

const points = [
  {
    icon: Target,
    title: "Why this exists",
    body: "PAC Africa places people for a living. This job board is the same work, made self-serve — the same standard of match, without waiting for an introduction.",
  },
  {
    icon: ShieldCheck,
    title: "How vetting works",
    body: "Every listing is reviewed by an admin before it publishes. Nothing goes live automatically, including roles PAC Africa posts itself.",
  },
  {
    icon: Globe2,
    title: "Where we place people",
    body: "Nairobi is home base. Roles and candidates span the continent, with placements reaching Lagos, Accra, Cape Town and beyond.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <span className="eyebrow">About</span>
      <h1 className="mt-3 max-w-2xl font-display text-4xl font-700 leading-[1.08] tracking-display text-ink">
        A placement firm, not a listings site that happened to add one.
      </h1>
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
        {site.owner} ({site.ownerFull}) has connected skilled professionals
        across the continent with employers ready to invest in them long
        before this site existed. This job board is how that same standard of
        match scales — every listing checked, every applicant real — without
        losing the review a direct introduction would have had.
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

      <div className="clay mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="font-display text-lg font-600 text-ink">
            Looking for work, or looking to hire?
          </p>
          <p className="mt-1 text-sm text-muted">
            Both sides start in the same place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/for-talent" className="btn-primary">
            For talent
          </Link>
          <Link href="/employers" className="btn-ghost">
            For employers
          </Link>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted">
        Questions about PAC Africa or this site?{" "}
        <a href="mailto:hello@pac.africa" className="text-accent-text hover:underline">
          hello@pac.africa
        </a>
        .
      </p>
    </div>
  );
}
