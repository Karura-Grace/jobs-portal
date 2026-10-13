import Link from "next/link";
import type { Profile } from "@/types/database";
import { completeness, profileChecklist } from "@/lib/profile";
import { isLegacyCvUrl } from "@/lib/cv";

/**
 * Shown on every seeker dashboard page, not just the overview, until the
 * profile is done — a one-off nudge on the homepage is easy to dismiss and
 * forget. The pitch is a real, already-shipped mechanic (app/jobs/[slug]/page.tsx
 * prefills the apply form from a complete profile), not an invented reward.
 */
export function ProfileNudge({
  profile,
  hasEducation,
  hasWorkExperience,
}: {
  profile: Profile;
  hasEducation: boolean;
  hasWorkExperience: boolean;
}) {
  const hasUsableCv = Boolean(profile.cv_url) && !isLegacyCvUrl(profile.cv_url);
  const progress = completeness(
    profileChecklist(profile, hasUsableCv, hasEducation, hasWorkExperience)
  );

  if (progress.percent >= 100) return null;

  return (
    <div className="clay mb-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-500 text-ink">
            Your profile is {progress.percent}% complete
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Finish it once and every application after this is one click — no
            retyping your details or re-uploading your CV.
          </p>
        </div>
        <Link href="/dashboard/seeker/profile" className="btn-secondary shrink-0">
          Finish profile
        </Link>
      </div>
      <div
        className="clay-inset mt-4 h-1.5 overflow-hidden rounded-pill"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile completeness"
      >
        <div
          className="h-full rounded-pill bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
