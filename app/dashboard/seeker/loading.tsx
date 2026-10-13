import { Skeleton, SkeletonStatCard, SkeletonCards } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-8 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <div className="mt-6">
        <SkeletonCards count={4} />
      </div>
    </div>
  );
}
