import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import { SettingsPanel } from "@/components/settings-panel";
import { dash } from "@/lib/content";

export default async function SeekerSettings({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { profile } = await requireProfile("seeker");
  const params = await searchParams;

  return (
    <div>
      <PageHead
        eyebrow={dash.common.settings}
        title={dash.seeker.settingsTitle}
        sub={dash.seeker.settingsSub}
      />
      <SettingsPanel
        profile={profile}
        updated={params.updated}
        error={params.error}
        exportHref="/dashboard/seeker/export"
      />
    </div>
  );
}
