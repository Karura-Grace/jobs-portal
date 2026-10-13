import { requireUser, hasHiringProfileEntries } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileNudge } from "@/components/profile-nudge";
import { displayApplicant } from "@/lib/utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, profile } = await requireUser();
  const [hasEducation, hasWorkExperience] =
    profile.role === "seeker"
      ? await hasHiringProfileEntries(supabase, profile.id)
      : [false, false];

  return (
    <DashboardShell
      role={profile.role}
      name={displayApplicant(profile.full_name, profile.email)}
      density={profile.dashboard_density}
    >
      {profile.role === "seeker" && (
        <ProfileNudge
          profile={profile}
          hasEducation={hasEducation}
          hasWorkExperience={hasWorkExperience}
        />
      )}
      {children}
    </DashboardShell>
  );
}
