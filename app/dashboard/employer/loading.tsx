import { Skeleton, SkeletonStatCard, SkeletonList } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <div className="mt-6">
        <SkeletonList rows={4} />
      </div>
    </div>
  );
}
