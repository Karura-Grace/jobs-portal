import { cn } from "@/lib/utils";
import { TableFrame, Th, Td, Tr } from "@/components/dashboard-ui";

/**
 * `motion-safe:` rather than a `useReducedMotion` hook — these render inside
 * `loading.tsx`, which Next streams in before any client JS runs, so a hook
 * would mean adding "use client" purely to stay still. Tailwind's variant
 * gets the same behaviour for free in a server component.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "motion-safe:animate-pulse rounded-card bg-black/5 dark:bg-white/5",
        className
      )}
    />
  );
}

/** Matches StatCard's shape (components/dashboard-ui.tsx) for dashboard grids. */
export function SkeletonStatCard() {
  return (
    <div className="clay p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-7 w-14" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}

/** Drop-in body for a TableFrame while its rows are still loading. */
export function SkeletonTable({
  columns,
  rows = 6,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <TableFrame>
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <Th key={i}>
              <Skeleton className="h-3 w-16" />
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <Tr key={r}>
            {Array.from({ length: columns }).map((_, c) => (
              <Td key={c}>
                <Skeleton className="h-4 w-full max-w-[140px]" />
              </Td>
            ))}
          </Tr>
        ))}
      </tbody>
    </TableFrame>
  );
}

/** Divided list inside one clay surface — admin review queues, moderation lists. */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="clay divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Grid of clay cards, for job listings and similar card layouts. */
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="clay space-y-3 p-5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
