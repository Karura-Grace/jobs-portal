"use server";

import { createClient } from "@/lib/supabase/server";
import { cvLink } from "@/lib/cv-access";
import type { CvLink } from "@/lib/cv";

/**
 * Signs a CV link only when someone actually clicks Open CV, not at page
 * render — a list of 50 applications was previously minting 50 signed URLs
 * up front regardless of whether any were ever opened. Each of these
 * re-queries the row through the request's own Supabase client, so the
 * existing RLS policies on `applications` / `profiles` (admin sees all,
 * employer sees their own jobs' applications, seeker sees their own) are
 * what actually gates access here — an id alone is not enough without a row
 * to match it.
 */

export async function signApplicationCv(applicationId: string): Promise<CvLink> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("cv_url")
    .eq("id", applicationId)
    .maybeSingle();
  return cvLink(supabase, (data as { cv_url: string | null } | null)?.cv_url);
}

export async function signSeekerProfileCv(profileId: string): Promise<CvLink> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("cv_url")
    .eq("id", profileId)
    .maybeSingle();
  return cvLink(supabase, (data as { cv_url: string | null } | null)?.cv_url);
}

export async function signMyProfileCv(): Promise<CvLink> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "none" };
  const { data } = await supabase
    .from("profiles")
    .select("cv_url")
    .eq("id", user.id)
    .maybeSingle();
  return cvLink(supabase, (data as { cv_url: string | null } | null)?.cv_url);
}
