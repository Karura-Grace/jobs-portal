import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { PageHead } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/dashboard-ui";
import { dash } from "@/lib/content";

/**
 * Placeholder, per the brief: "Show a 'Coming soon' clay card. Do not build the
 * messaging feature in this iteration."
 *
 * It says what to do instead rather than only that the feature is missing — an
 * employer arriving here still needs to reach a candidate today.
 */
export default async function EmployerMessages() {
  await requireProfile("employer");

  return (
    <div>
      <PageHead eyebrow={dash.common.comingSoon} title={dash.employer.messagesTitle} />
      <EmptyState
        icon={MessageSquare}
        title={dash.common.comingSoon}
        body={dash.employer.messagesBody}
        action={
          <Link href="/dashboard/employer/applications" className="btn-primary">
            {dash.employer.inboxTitle}
          </Link>
        }
      />
    </div>
  );
}
