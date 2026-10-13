"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";

/**
 * Toggles a bookmark. `saved_jobs` had a table and an own-row-only policy since
 * the original schema but no UI; the card's save button is the first use.
 *
 * Signed-out visitors are sent to signup carrying where they were, rather than
 * silently doing nothing — brief §7.
 */
export async function toggleSavedJob(formData: FormData) {
  const jobId = formData.get("job_id");
  const returnTo = safeNextPath(
    typeof formData.get("return_to") === "string"
      ? (formData.get("return_to") as string)
      : null,
    "/jobs"
  );

  if (typeof jobId !== "string") redirect(returnTo);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/signup?next=${encodeURIComponent(returnTo)}`);
  }

  // RLS confines both statements to this user's own rows, so there is no
  // ownership check to duplicate here.
  const { data: existing } = await supabase
    .from("saved_jobs")
    .select("id")
    .eq("job_id", jobId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("saved_jobs").delete().eq("id", (existing as { id: string }).id);
  } else {
    await supabase.from("saved_jobs").insert({ job_id: jobId, profile_id: user.id });
  }

  revalidatePath(returnTo);
  revalidatePath("/dashboard/seeker/saved");
  redirect(returnTo);
}
