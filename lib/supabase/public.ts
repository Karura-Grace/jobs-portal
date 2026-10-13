import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Anon-key client with no cookie handling at all — safe to call from inside
 * `unstable_cache`, unlike `lib/supabase/server.ts`, which reads the request's
 * cookies and so trips Next's "dynamic API used inside cache scope" error.
 * Only for tables that are genuinely public to read under RLS (job_categories,
 * job_locations): this carries no session, so an RLS policy that expects one
 * will just return nothing.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
