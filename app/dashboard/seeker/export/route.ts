import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Subject access request, self-service (Kenya Data Protection Act 2019 §26).
 *
 * A route handler rather than a server action because the response is a file
 * download, and an action can only return data to a React tree.
 *
 * Everything here is read through the caller's own session, so RLS is what
 * scopes it — this endpoint has no privilege of its own and cannot be tricked
 * into exporting someone else's records. `no-store` because the payload is
 * personal data and must not sit in a CDN.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [{ data: profile }, { data: applications }, { data: saved }, { data: events }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("applications")
        .select(
          `id, applicant_name, applicant_email, applicant_phone, cover_letter, cv_url,
           status, applied_at, wp_job_title, job:jobs(title, slug)`
        )
        .order("applied_at", { ascending: false }),
      supabase
        .from("saved_jobs")
        .select("created_at, job:jobs(title, slug)")
        .order("created_at", { ascending: false }),
      supabase
        .from("application_events")
        .select("application_id, from_status, to_status, created_at")
        .order("created_at", { ascending: false }),
    ]);

  const payload = {
    exported_at: new Date().toISOString(),
    // Named so a person reading the file knows what they are looking at, rather
    // than having to infer it from table names.
    about_this_file:
      "Everything jobs.pac.africa holds that is linked to your account. The employer_note field on an application is an employer's private note and is not included.",
    account: profile ?? null,
    applications: applications ?? [],
    application_history: events ?? [],
    saved_roles: saved ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="pac-jobs-data-${user.id.slice(0, 8)}.json"`,
      "cache-control": "no-store, max-age=0",
    },
  });
}
