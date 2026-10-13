import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * The service-role client. It bypasses row-level security completely.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  READ THIS BEFORE ADDING A SECOND CALLER.
 *
 *  Every other query in this codebase runs as the person making the request, so
 *  RLS is what keeps one user's data away from another. Anything that goes
 *  through here has no such protection: a missing `.eq()` is a full-table read
 *  and a wrong id is someone else's record.
 *
 *  It exists for exactly one job: writing a GUEST job application. A guest has
 *  no session, so there is no `auth.uid()` for a policy to check against, and
 *  migration 024 removed anonymous INSERT rather than leaving an open write
 *  endpoint on the applications table. The ownership check therefore has to move
 *  into code — and the code is deliberately narrow:
 *
 *    - it writes through `submit_guest_application()`, which fixes the column
 *      list, forces `applicant_id` to null and re-checks that the job is
 *      published, so a bug here cannot become an arbitrary insert;
 *    - it uploads one PDF to one bucket, at a path this process generates.
 *
 *  If you need elevated access for something else, prefer a `security definer`
 *  function scoped to that task and granted to `service_role`, so the privilege
 *  is bounded by SQL rather than by whoever is editing the TypeScript.
 *
 *  Second caller, added on exactly that basis: `app/api/cron/flush-views` calls
 *  `increment_job_views()` (migration 035) to add batched view counts to
 *  jobs.views. The function is service_role-only, touches only `jobs.views` of
 *  published rows, and the route itself is behind CRON_SECRET.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // Thrown rather than returning a broken client, so a missing key surfaces as
    // a failed submission with a log line instead of a silent no-op.
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — guest applications cannot be written."
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // No cookie handling on purpose: this client must never pick up a caller's
    // session and must never be used to answer a read on their behalf.
    global: { headers: { "x-pac-context": "guest-application" } },
  });
}
