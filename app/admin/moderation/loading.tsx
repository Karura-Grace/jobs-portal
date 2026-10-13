import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-8 w-64" />
      </div>
      <ul className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="clay space-y-3 p-5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </li>
        ))}
      </ul>
    </div>
  );
}
