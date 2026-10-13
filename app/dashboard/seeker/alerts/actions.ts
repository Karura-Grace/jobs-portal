"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import type { JobType } from "@/types/database";

const ALERTS = "/dashboard/seeker/alerts";
const fail = (message: string) => redirect(`${ALERTS}?error=${encodeURIComponent(message)}`);

const JOB_TYPES: JobType[] = ["full_time", "part_time", "freelance", "contract", "internship"];

/**
 * A row's `email` is stamped from the confirmed auth email at creation time,
 * not taken from the form — matching the trust boundary migration 006 already
 * established for claiming (a confirmed address is the only identity that
 * matters here), and so a change of alert destination requires a change of
 * account email rather than a form field.
 */
export async function createJobAlert(formData: FormData) {
  const { supabase, userId, profile } = await requireProfile("seeker");

  const text = (key: string) => {
    const v = formData.get(key);
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  };

  const jobType = text("job_type");
  const frequency = formData.get("frequency") === "weekly" ? "weekly" : "daily";

  const { error } = await supabase.from("job_alerts").insert({
    profile_id: userId,
    email: profile.email,
    keyword: text("keyword"),
    category_id: text("category_id"),
    location_id: text("location_id"),
    job_type: jobType && JOB_TYPES.includes(jobType as JobType) ? (jobType as JobType) : null,
    frequency,
  });

  if (error) fail(error.message);

  revalidatePath(ALERTS);
  redirect(`${ALERTS}?created=1`);
}

export async function toggleJobAlert(formData: FormData) {
  const { supabase, userId } = await requireProfile("seeker");
  const id = formData.get("id");
  const isActive = formData.get("is_active") === "true";
  if (typeof id !== "string") return fail("Missing alert.");

  const { error } = await supabase
    .from("job_alerts")
    .update({ is_active: !isActive })
    .eq("id", id)
    .eq("profile_id", userId);

  if (error) fail(error.message);
  revalidatePath(ALERTS);
  redirect(ALERTS);
}

export async function deleteJobAlert(formData: FormData) {
  const { supabase, userId } = await requireProfile("seeker");
  const id = formData.get("id");
  if (typeof id !== "string") return fail("Missing alert.");

  const { error } = await supabase
    .from("job_alerts")
    .delete()
    .eq("id", id)
    .eq("profile_id", userId);

  if (error) fail(error.message);
  revalidatePath(ALERTS);
  redirect(`${ALERTS}?deleted=1`);
}
