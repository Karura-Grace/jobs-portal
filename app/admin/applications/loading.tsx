import { Skeleton, SkeletonList } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-2 h-8 w-64" />
      </div>
      <SkeletonList rows={8} />
    </div>
  );
}
