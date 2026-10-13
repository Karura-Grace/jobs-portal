import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { gate, nav } from "@/lib/content";
import type { UserRole } from "@/types/database";

/**
 * The "Post a Job" gate for seekers (brief §7).
 *
 * The brief describes a clay interstitial modal. Built as a real route rather
 * than a client modal for two reasons: the role is already known server-side so
 * there is nothing to discover after hydration, and it works with JavaScript
 * off. Everyone who is not a seeker is redirected before anything renders —
 * "no silent rejection" applies to seekers, not to sending an employer to the
 * form they actually wanted.
 */
export default async function PostAJobGate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signup?next=/post-a-job");

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (data?.role as UserRole) ?? "seeker";
  if (role === "employer") redirect("/dashboard/employer/post");
  if (role === "admin") redirect("/admin/jobs/new");

  return (
    <div className="mx-auto max-w-lg px-6 py-24">
      <div className="clay p-8">
        <div className="clay-raised mb-5 grid h-11 w-11 place-items-center rounded-card">
          <Briefcase className="h-5 w-5 text-accent-text" aria-hidden />
        </div>

        <h1 className="font-display text-2xl font-700 leading-tight tracking-display text-ink">
          {gate.seekerCannotPost.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {gate.seekerCannotPost.body}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href="/employers" className="btn-primary">
            {gate.seekerCannotPost.learn}
          </Link>
          <Link href="/jobs" className="btn-ghost">
            {gate.seekerCannotPost.dismiss}
          </Link>
        </div>

        <p className="mt-6 border-t border-line pt-5 text-xs text-muted">
          Signed in as a job seeker.{" "}
          <Link href="/dashboard/seeker" className="text-accent-text hover:underline">
            {nav.dashboard}
          </Link>
        </p>
      </div>
    </div>
  );
}
