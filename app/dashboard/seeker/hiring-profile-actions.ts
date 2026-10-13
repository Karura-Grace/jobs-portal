"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import type { EducationLevel } from "@/types/database";

const PROFILE = "/dashboard/seeker/profile";
const fail = (message: string) => redirect(`${PROFILE}?error=${encodeURIComponent(message)}`);

const EDUCATION_LEVELS: EducationLevel[] = [
  "high_school",
  "certificate",
  "diploma",
  "bachelors",
  "masters",
  "doctorate",
];

function text(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function yearOrNull(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Delete-and-re-add only, no edit — a first pass, same surface job_alerts
 * shipped with (create/pause/resume/delete, no edit).
 */
export async function addEducation(formData: FormData) {
  const { supabase, userId } = await requireProfile("seeker");

  const schoolName = text(formData, "school_name");
  if (!schoolName) return fail("School name is required.");

  const levelRaw = text(formData, "level");
  const level =
    levelRaw && (EDUCATION_LEVELS as string[]).includes(levelRaw)
      ? (levelRaw as EducationLevel)
      : null;

  const { error } = await supabase.from("profile_education").insert({
    profile_id: userId,
    school_name: schoolName,
    field_of_study: text(formData, "field_of_study"),
    level,
    start_year: yearOrNull(formData, "start_year"),
    end_year: yearOrNull(formData, "end_year"),
  });

  if (error) fail(error.message);
  revalidatePath(PROFILE);
  redirect(`${PROFILE}?education=1`);
}

export async function deleteEducation(formData: FormData) {
  const { supabase, userId } = await requireProfile("seeker");
  const id = formData.get("id");
  if (typeof id !== "string") return fail("Missing entry.");

  const { error } = await supabase
    .from("profile_education")
    .delete()
    .eq("id", id)
    .eq("profile_id", userId);

  if (error) fail(error.message);
  revalidatePath(PROFILE);
  redirect(PROFILE);
}

export async function addWorkExperience(formData: FormData) {
  const { supabase, userId } = await requireProfile("seeker");

  const companyName = text(formData, "company_name");
  const jobTitle = text(formData, "job_title");
  if (!companyName || !jobTitle) return fail("Company and job title are required.");

  const { error } = await supabase.from("profile_work_experience").insert({
    profile_id: userId,
    company_name: companyName,
    job_title: jobTitle,
    start_date: text(formData, "start_date"),
    end_date: text(formData, "end_date"),
    description: text(formData, "description"),
  });

  if (error) fail(error.message);
  revalidatePath(PROFILE);
  redirect(`${PROFILE}?experience=1`);
}

export async function deleteWorkExperience(formData: FormData) {
  const { supabase, userId } = await requireProfile("seeker");
  const id = formData.get("id");
  if (typeof id !== "string") return fail("Missing entry.");

  const { error } = await supabase
    .from("profile_work_experience")
    .delete()
    .eq("id", id)
    .eq("profile_id", userId);

  if (error) fail(error.message);
  revalidatePath(PROFILE);
  redirect(PROFILE);
}
