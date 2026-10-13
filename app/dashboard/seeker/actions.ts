"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import {
  CV_ACCEPT,
  CV_BUCKET,
  CV_MAX_BYTES,
  cvObjectPath,
  looksLikePdf,
} from "@/lib/cv";
import {
  AVATAR_BUCKET,
  IMAGE_MAX_BYTES,
  avatarObjectPath,
  looksLikeImage,
} from "@/lib/avatar";
import { normaliseLinkedIn } from "@/lib/profile";
import type { EducationLevel, NoticePeriod } from "@/types/database";

const EDUCATION_LEVELS: EducationLevel[] = [
  "high_school",
  "certificate",
  "diploma",
  "bachelors",
  "masters",
  "doctorate",
];
const NOTICE_PERIODS: NoticePeriod[] = [
  "immediate",
  "two_weeks",
  "one_month",
  "two_months",
  "three_plus_months",
];

function intOrNull(key: string, formData: FormData): number | null {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function enumOrNull<T extends string>(value: string | null, allowed: T[]): T | null {
  return value && (allowed as string[]).includes(value) ? (value as T) : null;
}

/**
 * Attaches historical applications filed under this user's confirmed email.
 * All the safety lives in the RPC (migration 006): the address comes from
 * auth.users, and an unconfirmed address claims nothing.
 */
export async function claimApplications() {
  const { supabase } = await requireProfile("seeker");

  const { data, error } = await supabase.rpc("claim_historical_applications");
  if (error) {
    redirect(`/dashboard/seeker?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/seeker");
  redirect(`/dashboard/seeker?claimed=${(data as number) ?? 0}`);
}

export async function updateProfile(formData: FormData) {
  const { supabase, userId } = await requireProfile("seeker");

  const text = (key: string) => {
    const v = formData.get(key);
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  };

  // Stored as text[]; the form takes a comma-separated list.
  const rawSkills = formData.get("skills");
  const skills =
    typeof rawSkills === "string" && rawSkills.trim() !== ""
      ? rawSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 40)
      : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: text("full_name"),
      phone: text("phone"),
      headline: text("headline"),
      bio: text("bio"),
      address: text("address"),
      linkedin_url: normaliseLinkedIn(text("linkedin_url")),
      skills,
      // Hiring profile depth (migration 033). All optional.
      years_experience: intOrNull("years_experience", formData),
      education_level: enumOrNull(text("education_level"), EDUCATION_LEVELS),
      industry_category_id: text("industry_category_id"),
      expected_salary: intOrNull("expected_salary", formData),
      current_salary: intOrNull("current_salary", formData),
      notice_period: enumOrNull(text("notice_period"), NOTICE_PERIODS),
    })
    .eq("id", userId);

  if (error) {
    redirect(`/dashboard/seeker/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/seeker/profile");
  redirect("/dashboard/seeker/profile?saved=1");
}

export async function uploadCv(formData: FormData) {
  const { supabase, userId } = await requireProfile("seeker");

  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/dashboard/seeker/profile?error=Choose+a+PDF+to+upload");
  }

  // The bucket enforces both of these too (migration 007). Checking here as
  // well turns a storage rejection into a message the applicant can act on.
  if (file.type !== CV_ACCEPT) {
    redirect("/dashboard/seeker/profile?error=CV+must+be+a+PDF");
  }
  if (file.size > CV_MAX_BYTES) {
    redirect("/dashboard/seeker/profile?error=CV+must+be+under+5MB");
  }
  // Server-side, so unlike the browser-side apply form this cannot be skipped:
  // checks the bytes rather than the content type the client claimed.
  if (!(await looksLikePdf(file))) {
    redirect(
      "/dashboard/seeker/profile?error=" +
        encodeURIComponent("That file is not a PDF, even though it is named like one.")
    );
  }

  const path = cvObjectPath(file.name);
  const { error: uploadError } = await supabase.storage
    .from(CV_BUCKET)
    .upload(path, file, { contentType: CV_ACCEPT, upsert: false });

  if (uploadError) {
    redirect(
      `/dashboard/seeker/profile?error=${encodeURIComponent(uploadError.message)}`
    );
  }

  // Store the object path, never a URL — see lib/cv.ts.
  const { error } = await supabase
    .from("profiles")
    .update({ cv_url: path })
    .eq("id", userId);

  if (error) {
    redirect(`/dashboard/seeker/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/seeker/profile");
  redirect("/dashboard/seeker/profile?cv=1");
}

const PROFILE = "/dashboard/seeker/profile";
const fail = (message: string) => redirect(`${PROFILE}?error=${encodeURIComponent(message)}`);

/**
 * Profile photo (brief §8).
 *
 * The old object is deleted after the new one is recorded, not before: if the
 * upload succeeds and the profile update fails, the account keeps a photo that
 * works rather than losing both.
 */
export async function uploadAvatar(formData: FormData) {
  const { supabase, userId, profile } = await requireProfile("seeker");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) fail("Choose an image to upload.");
  const image = file as File;

  if (image.size > IMAGE_MAX_BYTES) fail("That image is larger than 2MB.");
  // Reads the bytes rather than trusting the content type the browser reported.
  if (!(await looksLikeImage(image))) {
    fail("That file is not a JPEG, PNG or WebP image.");
  }

  const path = avatarObjectPath(userId, image.name);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, image, { contentType: image.type, upsert: false });

  if (uploadError) fail(uploadError.message);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", userId);

  if (error) fail(error.message);

  // Best effort. A stale object costs 2MB of storage; failing the request over
  // it would cost the user their new photo.
  if (profile.avatar_url && profile.avatar_url !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_url]);
  }

  revalidatePath(PROFILE);
  redirect(`${PROFILE}?avatar=1`);
}
