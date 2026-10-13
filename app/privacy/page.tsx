import Link from "next/link";
import type { Metadata } from "next";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: "Data & Cookies",
  description:
    "What personal data jobs.pac.africa collects, where it is stored, who can see it, and how to have it removed.",
};

/**
 * Data and cookies policy.
 *
 * NOT LEGAL ADVICE — this is an accurate description of what the system does,
 * written so a lawyer has something factual to review rather than a template to
 * rewrite. Two things in here are decisions only PAC can make and are marked in
 * the page itself: the retention period, and ODPC registration.
 *
 * Every factual claim below was checked against the running system:
 *   - Supabase project region is eu-west-1 (Ireland), so this is a cross-border
 *     transfer out of Kenya and says so.
 *   - An anonymous request to this site sets no cookies at all. Only the
 *     Supabase session cookie appears, after sign-in.
 *   - Vercel Web Analytics is cookieless, and components/web-analytics.tsx
 *     drops admin/dashboard paths and strips query strings before sending.
 *
 * The prose lives here rather than in lib/content.ts on purpose: content.ts is
 * for interface strings that get reused and localised, not for a legal document
 * that is read top to bottom in one place.
 */

const updated = "20 August 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <span className="eyebrow">Legal</span>
      <h1 className="mt-3 font-display text-4xl font-700 leading-[1.05] tracking-display text-ink">
        Data &amp; cookies
      </h1>
      <p className="mt-4 text-sm text-muted">Last updated {updated}</p>

      <div className="clay mt-8 p-6 md:p-8">
        <p className="text-sm leading-relaxed text-ink/90">
          This page explains what we hold about you, where it lives, who can see
          it, and how to get it removed. {site.owner} ({site.ownerFull}) is the
          data controller. Questions or requests:{" "}
          <a href="mailto:hello@pac.africa" className="text-accent-text hover:underline">
            hello@pac.africa
          </a>
          . See also our{" "}
          <Link href="/terms" className="text-accent-text hover:underline">
            Terms of service
          </Link>
          .
        </p>
      </div>

      <div className="mt-10 space-y-10">
        <Section title="What we collect">
          <p>When you apply for a role, we collect what you give us:</p>
          <List
            items={[
              "Your name, email address and phone number",
              "Your CV, if you attach one",
              "Your cover letter, if you write one",
              "The role you applied for and when",
            ]}
          />
          <p>
            If you create an account, we also store what you choose to add to
            your profile — a headline, a short bio, skills, your county or town, a
            LinkedIn link, and a CV kept on file so you do not have to attach it
            each time. Roles you save are stored against your account.
          </p>
          <p>
            We do not ask for, and do not want, your national ID number, date of
            birth, marital status, religion, ethnicity, health information or a
            photograph. If your CV happens to contain any of that, it is in the
            file you sent us and we do not extract or index it.
          </p>
        </Section>

        <Section title="Applications made before this site">
          <p>
            PAC Africa ran an earlier version of this job board. Applications
            made through it were carried across, so we may already hold an
            application you submitted before you ever visited this site,
            including the CV attached to it.
          </p>
          <p>
            If you create an account with the same email address you applied
            with, you can claim those records and see your own history. Nobody
            else can see them, and claiming requires you to confirm your email
            address first — which is precisely so that somebody who merely knows
            your address cannot claim your history.
          </p>
        </Section>

        <Section title="Who can see it">
          <List
            items={[
              "PAC Africa staff, who review applications as part of placing candidates.",
              "The employer for the specific role you applied to — your name, contact details, cover letter and CV. They cannot see applications you made to other roles.",
              "Nobody else. Your CV is never public, is never listed in a search engine, and is only ever reachable through a private link that expires after five minutes.",
            ]}
          />
          <p>
            Employers do not see applications to other employers' roles, and
            other applicants never see yours. Access is enforced by the database
            itself rather than by the interface, so it holds even if somebody
            queries our API directly.
          </p>
        </Section>

        <Section title="Where it is stored">
          <p>
            We use three providers. Two of them mean your data leaves Kenya, and
            you should know that:
          </p>
          <List
            items={[
              "Supabase — the database holding your application and profile. Hosted in Ireland (eu-west-1).",
              "Cloudflare R2 — where CV files are stored. Private, and only reachable through a short-lived signed link.",
              "Vercel — serves the website itself.",
            ]}
          />
          <p>
            Because the database is in Ireland, your personal data is transferred
            outside Kenya. Under the Data Protection Act 2019 you are entitled to
            know that, which is why it is stated plainly here rather than buried.
            Ireland is subject to the EU GDPR, which sets a standard of protection
            comparable to Kenya's.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            <strong className="text-ink">
              We do not use tracking or advertising cookies, and there is nothing
              here to consent to.
            </strong>{" "}
            Browsing this site anonymously sets no cookies at all.
          </p>
          <p>
            If you sign in, we set one session cookie so you stay signed in
            between pages. It is strictly necessary — without it, signing in would
            not work — and it holds no advertising identifier. Your theme
            preference is kept in your own browser's local storage and never
            reaches us.
          </p>
          <p>
            We measure page views with a privacy-friendly, cookieless analytics
            tool that does not build a profile of you. We deliberately strip the
            query string from every recorded URL and record nothing at all for
            staff pages, so a search typed into an internal screen never leaves
            the product.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Applications are kept so that employers can review them and so you
            can see your own history. Our records currently go back to 2023.
          </p>
          {/* A retention period is a business decision with legal weight; it is
              not ours to invent. Stated honestly until PAC sets one. */}
          <p className="rounded-card border border-accent/30 bg-accent/[0.06] px-4 py-3 text-sm">
            <strong className="text-ink">Under review:</strong> PAC Africa is
            setting a defined retention period for applications and CVs. Until
            then, records are kept indefinitely and you can ask us to delete
            yours at any time using the contact address above.
          </p>
        </Section>

        <Section title="Your rights">
          <p>Under the Data Protection Act 2019 you can ask us to:</p>
          <List
            items={[
              "Tell you what we hold about you, and give you a copy.",
              "Correct anything that is wrong.",
              "Delete your data, including your CV.",
              "Stop using it for a particular purpose.",
              "Hand it to you in a portable form.",
            ]}
          />
          <p>
            Email{" "}
            <a href="mailto:hello@pac.africa" className="text-accent-text hover:underline">
              hello@pac.africa
            </a>{" "}
            and we will respond within 30 days. Deleting your account removes your
            profile and CV; where an employer has already received an application,
            we will tell you what has been shared and with whom.
          </p>
          <p>
            If you are unhappy with how we have handled your data, you can
            complain to the Office of the Data Protection Commissioner of Kenya.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Access to applications and CVs is enforced in the database itself, so
            a role you did not post is not readable by you even through our API.
            Passwords are handled by our authentication provider and are never
            visible to us. We keep this under continuous review and improve it as
            the platform grows.
          </p>
          <p>
            If we ever believe your data has been exposed, we will tell you.
          </p>
        </Section>
      </div>

      <div className="clay mt-12 p-6">
        <p className="text-sm text-muted">
          Want your data removed, or want to know what we hold?{" "}
          <a href="mailto:hello@pac.africa" className="text-accent-text hover:underline">
            hello@pac.africa
          </a>
          .
        </p>
        <Link
          href="/jobs"
          className="mt-4 inline-block text-sm text-accent-text hover:underline"
        >
          Back to jobs
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-600 tracking-tight text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
