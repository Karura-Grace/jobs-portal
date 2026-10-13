import { redirect } from "next/navigation";

/**
 * There used to be a per-job applicants page here. The unified inbox replaced it
 * (brief §9) — two implementations of "the list of people who applied" would
 * drift, and the inbox already filters by job.
 *
 * Kept as a redirect rather than deleted: existing links, bookmarks and the
 * dashboard's own history all point here.
 */
export default async function JobApplicantsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/employer/applications?job=${id}`);
}
