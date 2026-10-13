import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import { SettingsPanel } from "@/components/settings-panel";
import { dash } from "@/lib/content";

export default async function EmployerSettings({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { profile } = await requireProfile("employer");
  const params = await searchParams;

  return (
    <div>
      <PageHead
        eyebrow={dash.common.settings}
        title={dash.common.settings}
        sub="Your sign-in details. Company details live on the Company page."
      />
      {/* No data export here: an employer's own record is their company profile,
          which they can already read and edit in full. The export exists for
          seekers, whose applications and CV they cannot otherwise take with
          them. */}
      <SettingsPanel profile={profile} updated={params.updated} error={params.error} />
    </div>
  );
}
