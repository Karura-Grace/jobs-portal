import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/lib/content";

/**
 * Every public URL, so a listing is found the day it publishes rather than
 * whenever a crawler happens across it.
 *
 * Only published jobs appear, and that is enforced by RLS rather than by the
 * filter below — `jobs_select_published` is what this query runs under, so a
 * draft cannot leak into the sitemap even if someone removes the `.eq()`.
 *
 * No employer names and no company URLs: the company behind a role is
 * admin-only, and a sitemap is the most public surface there is.
 */
export const revalidate = 3600;

const BASE = `https://${site.domain}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("jobs")
    .select("slug, updated_at, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(5000);

  const jobs = ((data as { slug: string; updated_at: string; created_at: string }[] | null) ?? []).map(
    (job) => ({
      url: `${BASE}/jobs/${job.slug}`,
      lastModified: new Date(job.updated_at ?? job.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })
  );

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/jobs`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/employers`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/for-talent`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/post-a-job`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.3 },
    ...jobs,
  ];
}
