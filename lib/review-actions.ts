"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/job-form";
import type { ApplicationReviewMode } from "@/types/database";

/**
 * Logs a review pass on an application (migration 029). Shared by the
 * employer inbox and the admin applications view — RLS decides what either
 * of them is actually allowed to write, this just carries the form.
 */
export async function addApplicationReview(formData: FormData) {
  const { supabase, userId } = await requireUser();

  const applicationId = str(formData, "application_id");
  const mode = str(formData, "mode");
  const raw = str(formData, "return_to");
  const returnTo = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  if (!applicationId || (mode !== "overview" && mode !== "final")) {
    redirect(`${returnTo}?error=Invalid+request`);
  }

  const opinion = str(formData, "opinion");

  const { error } = await supabase.from("application_reviews").insert({
    application_id: applicationId,
    reviewer_id: userId,
    mode: mode as ApplicationReviewMode,
    opinion: mode === "final" ? opinion || null : null,
  });

  if (error) redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`);

  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}reviewed=${mode}`);
}
