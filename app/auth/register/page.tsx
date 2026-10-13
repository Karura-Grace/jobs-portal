import { redirect } from "next/navigation";

/**
 * The brief standardises on /auth/signup. This route existed first and is
 * linked from earlier copy and any bookmarks, so it forwards rather than 404s —
 * carrying ?next= through so a gated action still lands where it was going.
 */
export default async function RegisterRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(next ? `/auth/signup?next=${encodeURIComponent(next)}` : "/auth/signup");
}
