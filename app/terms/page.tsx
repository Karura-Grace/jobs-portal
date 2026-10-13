import Link from "next/link";
import type { Metadata } from "next";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern using jobs.pac.africa as a job seeker or an employer.",
};

/**
 * Terms of Service.
 *
 * FIRST DRAFT, NOT LEGAL ADVICE — this describes what the system actually
 * does and enforces (moderation, suspension, account rules), written so a
 * lawyer has something factual to review and tighten rather than a blank
 * page to start from. It should be reviewed by PAC/legal before being
 * treated as binding. See app/privacy/page.tsx for the same convention —
 * that page similarly marks its own open decisions rather than guessing.
 *
 * Every behavioural claim below matches what the database actually enforces,
 * not just what the UI suggests:
 *   - listings only reach the public site after an admin publishes them
 *     (migrations 012, 019, 021 — guard_job_status());
 *   - a suspended account cannot apply or post, enforced by trigger rather
 *     than only in the interface (migration 022);
 *   - account role/email cannot be self-changed (migration 025).
 */

const updated = "20 August 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <span className="eyebrow">Legal</span>
      <h1 className="mt-3 font-display text-4xl font-700 leading-[1.05] tracking-display text-ink">
        Terms of service
      </h1>
      <p className="mt-4 text-sm text-muted">Last updated {updated}</p>

      <div className="clay mt-8 p-6 md:p-8">
        <p className="text-sm leading-relaxed text-ink/90">
          These terms govern your use of {site.domain}, operated by{" "}
          {site.owner} ({site.ownerFull}). By creating an account, posting a
          role, or applying for one, you agree to them. Questions:{" "}
          <a href="mailto:hello@pac.africa" className="text-accent-text hover:underline">
            hello@pac.africa
          </a>
          .
        </p>
      </div>

      <div className="mt-10 space-y-10">
        <Section title="What this site is">
          <p>
            {site.owner} operates {site.domain} to connect job seekers with
            employers across Kenya and East Africa. We are not a party to any
            employment contract that results from a connection made here, and
            we do not guarantee that any application will lead to an
            interview, an offer, or a hire.
          </p>
        </Section>

        <Section title="Accounts">
          <List
            items={[
              "You must give accurate information when you register, and keep your contact details current.",
              "You are responsible for activity on your account. Tell us if you believe it has been accessed without your permission.",
              "Your account role (seeker, employer, or admin) is set by us and cannot be changed by editing your own profile.",
              "We may suspend an account that breaches these terms. A suspended seeker cannot apply for roles and a suspended employer cannot post or edit listings — this is enforced by the system itself, not only by staff review.",
            ]}
          />
        </Section>

        <Section title="If you are applying for a role">
          <List
            items={[
              "What you submit — your name, contact details, CV, and cover letter — is shared with the employer for that specific role only.",
              "Do not apply on behalf of someone else, or using contact details that are not your own.",
              "Do not submit anything false, or a CV containing content you do not have the right to share.",
            ]}
          />
          <p>
            You can withdraw an application or delete your account at any
            time; see{" "}
            <Link href="/privacy" className="text-accent-text hover:underline">
              Data &amp; cookies
            </Link>{" "}
            for what that removes and what an employer may already have
            received.
          </p>
        </Section>

        <Section title="If you are posting a role">
          <List
            items={[
              "A listing you submit is reviewed before it appears publicly. We may reject a listing, or ask you to change it, at our discretion — including for roles that are misleading, discriminatory, unlawful, or not a genuine vacancy.",
              "You are responsible for the accuracy of what you post: the role, the requirements, the compensation, and your company's identity.",
              "You may pause a published listing and resume it later without re-review, provided you have not changed anything a reviewer would need to see again (title, description, requirements, qualifications, company, category, location, type, level, salary, remote status, or deadline). Changing any of those returns the listing to review before it can go public again.",
              "We may remove a listing, or suspend the employer account behind it, if it breaches these terms. A suspended employer's published listings come down from the public site immediately.",
              "Applicant details you receive through this site are for the purpose of considering that application. They are not yours to use for any other purpose, sell, or share beyond your own hiring process.",
            ]}
          />
        </Section>

        <Section title="Acceptable use">
          <p>You may not:</p>
          <List
            items={[
              "Attempt to access another user's account, applications, or data.",
              "Scrape, automate, or bulk-extract listings or applicant information.",
              "Use the site to send unsolicited commercial messages to seekers or employers.",
              "Interfere with the site's operation, including attempting to bypass rate limits, authentication, or the moderation queue.",
            ]}
          />
        </Section>

        <Section title="No warranty">
          <p>
            The site is provided as-is. We do not warrant that listings are
            accurate, that applicants are who they claim to be, or that the
            service will be uninterrupted or error-free. To the extent
            permitted by Kenyan law, {site.owner} is not liable for losses
            arising from your use of the site, including a hiring decision
            made or not made as a result of it.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms as the product changes. If we make a
            material change, we will update the date above; continued use
            after that means you accept the revised terms.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of Kenya. Disputes arising
            from your use of the site are subject to the jurisdiction of the
            Kenyan courts.
          </p>
        </Section>
      </div>

      <div className="clay mt-12 p-6">
        <p className="text-sm text-muted">
          Questions about these terms?{" "}
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
