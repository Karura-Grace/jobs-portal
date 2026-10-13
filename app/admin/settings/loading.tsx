import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-8 w-48" />
      </div>
      <div className="clay max-w-2xl space-y-4 p-6">
        <Skeleton className="h-3.5 w-1/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-3.5 w-1/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="mt-2 h-9 w-32" />
      </div>
    </div>
  );
}
