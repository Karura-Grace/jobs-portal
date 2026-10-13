import { createClient } from "@/lib/supabase/server";
import type { JobCategory, JobLocation } from "@/types/database";

/**
 * Category and location options for the job forms. 165 categories and 65
 * locations came across from WordPress, so both are fetched whole rather than
 * truncated — the old sidebar showed only the first 12 and silently dropped
 * the rest.
 */
export async function getJobLookups(): Promise<{
  categories: Pick<JobCategory, "id" | "name">[];
  locations: Pick<JobLocation, "id" | "name">[];
}> {
  const supabase = await createClient();
  const [categories, locations] = await Promise.all([
    supabase.from("job_categories").select("id, name").order("name").limit(300),
    supabase.from("job_locations").select("id, name").order("name").limit(200),
  ]);

  return {
    categories: (categories.data as Pick<JobCategory, "id" | "name">[]) ?? [],
    locations: (locations.data as Pick<JobLocation, "id" | "name">[]) ?? [],
  };
}
