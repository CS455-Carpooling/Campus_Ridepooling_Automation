import { DesignSystem } from '@/components/ui/DesignSystem';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';

/**
 * Shown instantly by Next.js while the /rides/results server component fetches
 * search results. Three skeleton cards mimic the shape of RideCard.
 */
export default function RideResultsLoading() {
  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* Back link skeleton */}
      <Skeleton className="h-5 w-24" />

      {/* Page heading skeleton */}
      <Skeleton className="mt-8 h-9 w-52" />
      <Skeleton className="mt-2 h-4 w-40" />

      <LoadingRegion label="Searching for rides" className="mt-8 flex flex-col gap-6">
        {/* Three skeleton ride cards */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-panel border border-line-strong bg-surface p-5 sm:p-6"
            aria-hidden="true"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-44" />
              </div>
              <Skeleton className="h-6 w-20 shrink-0" />
            </div>

            {/* Details grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>

            {/* People row */}
            <div className="border-t border-line pt-3">
              <Skeleton className="h-4 w-48" />
            </div>

            {/* View button */}
            <Skeleton className="h-11 w-28" />
          </div>
        ))}
      </LoadingRegion>
    </DesignSystem>
  );
}

