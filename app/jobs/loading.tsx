import { Skeleton, SkeletonCards } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-9 w-72" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Skeleton className="h-64 w-full" />
        <SkeletonCards count={6} />
      </div>
    </div>
  );
}
