import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import { SettingsPanel } from "@/components/settings-panel";
import { dash, site } from "@/lib/content";

/**
 * Admin settings.
 *
 * Most of what an admin would look for here is not configurable from the app —
 * it lives in Supabase, Vercel or Cloudflare. So the page states plainly where
 * each thing is, rather than offering a control that would do nothing. The two
 * outstanding items are named because they are outstanding, not because they are
 * settings this page owns.
 */
const EXTERNAL: { label: string; where: string; note: string }[] = [
  {
    label: "Leaked-password protection",
    where: "Supabase → Authentication → Policies",
    note: "Checks new passwords against HaveIBeenPwned. Still off. One toggle, and worth it given how this site came to be rebuilt.",
  },
  {
    label: "Request rate limiting",
    where: "Vercel → Firewall",
    note: "The apply form and the auth routes are the two worth a rule. Nothing in the app can do this — it has to happen at the edge.",
  },
  {
    label: "Email delivery",
    where: "Resend",
    note: "Sending domain still needs verifying at resend.com/domains — until then, real addresses bounce and only the account owner's inbox receives anything.",
  },
  {
    label: "CV archive",
    where: "Cloudflare R2",
    note: "The recovered CVs from the previous site. Links are presigned per view and expire in a minute.",
  },
];

export default async function AdminSettings({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { profile } = await requireProfile("admin");
  const params = await searchParams;

  return (
    <div>
      <PageHead
        eyebrow={dash.common.settings}
        title={dash.admin.settingsTitle}
        sub={dash.admin.settingsSub}
      />

      <section className="clay mb-6 max-w-2xl p-6">
        <h2 className="font-display text-lg font-600 text-ink">Configured elsewhere</h2>
        <ul className="mt-4 space-y-4">
          {EXTERNAL.map((item) => (
            <li key={item.label} className="border-l-2 border-line pl-3.5">
              <p className="text-sm font-500 text-ink">{item.label}</p>
              <p className="eyebrow mt-0.5">{item.where}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{item.note}</p>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm">
          <Link
            href="/privacy"
            className="inline-flex items-center gap-1.5 text-accent-text transition-opacity duration-150 hover:opacity-70"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {site.domain} privacy and cookie policy
          </Link>
        </p>
      </section>

      <SettingsPanel profile={profile} updated={params.updated} error={params.error} />
    </div>
  );
}
