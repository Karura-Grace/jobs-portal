import { DashboardNav } from "@/components/dashboard-nav";
import type { UserRole } from "@/types/database";

/**
 * The frame every dashboard page renders inside — one component so the seeker,
 * employer and admin areas cannot drift apart, even though `/admin` sits outside
 * the `/dashboard` route group.
 *
 * `pb-28 lg:pb-16` is load-bearing: the mobile tab bar is fixed, so without the
 * extra bottom padding the last row of every table sits underneath it.
 */
export function DashboardShell({
  role,
  name,
  density = "comfortable",
  children,
}: {
  role: UserRole;
  name?: string;
  density?: "comfortable" | "compact";
  children: React.ReactNode;
}) {
  return (
    <div
      data-density={density}
      className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:pb-16 lg:pt-10"
    >
      <div className="flex gap-8 xl:gap-10">
        <DashboardNav role={role} name={name} />
        {/* A div, not a <main>: the root layout already renders one, and nesting
            them is invalid and confuses landmark navigation. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/**
 * Page header. Every dashboard page opens with one, so the eyebrow/title/action
 * rhythm is identical across all three roles rather than re-typed per page.
 */
export function PageHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1.5 font-display text-[1.75rem] font-700 tracking-display text-ink sm:text-3xl">
          {title}
        </h1>
        {sub && <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
