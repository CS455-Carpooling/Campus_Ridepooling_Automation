import { DesignSystem } from '@/components/ui/DesignSystem';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';

/** Skeleton in the shape of the review page, shown while it loads. */
export default function RideReviewLoading() {
  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <LoadingRegion label="Loading the review page">
        <Skeleton className="h-11 w-36" />
        <Skeleton className="mt-6 h-4 w-28" />
        <Skeleton className="mt-3 h-10 w-64 max-w-full" />
        <Skeleton className="mt-4 h-6 w-56 max-w-full" />
        <Skeleton className="mt-3 h-7 w-64 max-w-full" />
        <Skeleton className="mt-8 h-32 w-full" />
        <Skeleton className="mt-10 h-7 w-72 max-w-full" />
        <div className="mt-4 space-y-4">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </LoadingRegion>
    </DesignSystem>
  );
}
