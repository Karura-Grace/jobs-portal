import { requireProfile } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { displayApplicant } from "@/lib/utils";

/**
 * The admin area sits outside `/dashboard` — it always has, and moving it now
 * would break every bookmark PAC staff have. It shares the same shell, so the
 * three dashboards look and navigate identically.
 *
 * The role check lives here as well as in each page: a layout guard alone is not
 * enough (Next.js does not guarantee layouts run before every page render path),
 * and a page guard alone would leave the shell rendering a nav the visitor
 * cannot use.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile("admin");

  return (
    <DashboardShell
      role="admin"
      name={displayApplicant(profile.full_name, profile.email)}
      density={profile.dashboard_density}
    >
      {children}
    </DashboardShell>
  );
}
