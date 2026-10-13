import { redirect } from "next/navigation";
import { requireUser, dashboardPathFor } from "@/lib/auth";

/**
 * Neutral landing spot. Login does not know the user's role at the point it
 * redirects, so it sends everyone here and this routes by role.
 */
export default async function DashboardIndex() {
  const { profile } = await requireUser();
  redirect(profile.dashboard_landing || dashboardPathFor(profile.role));
}
