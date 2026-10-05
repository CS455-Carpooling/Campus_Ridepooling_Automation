import { DesignSystem } from '@/components/ui/DesignSystem';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';

/** Skeleton in the shape of the ride details page, shown while it loads. */
export default function RideLoading() {
  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <LoadingRegion label="Loading the ride">
        <Skeleton className="h-11 w-28" />
        <Skeleton className="mt-6 h-4 w-28" />
        <Skeleton className="mt-3 h-10 w-64 max-w-full" />
        <Skeleton className="mt-4 h-6 w-56 max-w-full" />
        <Skeleton className="mt-3 h-7 w-44" />
        <Skeleton className="mt-8 h-28 w-full" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
        <Skeleton className="mt-10 h-7 w-48" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
        <Skeleton className="mt-10 h-11 w-64 max-w-full" />
      </LoadingRegion>
    </DesignSystem>
  );
}
