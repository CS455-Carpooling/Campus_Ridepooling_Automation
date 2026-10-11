import { DesignSystem } from '@/components/ui/DesignSystem';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';

/** Skeleton in the shape of the complaint form, shown while it loads. */
export default function RideComplaintLoading() {
  return (
    <DesignSystem className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <LoadingRegion label="Loading the complaint form">
        <Skeleton className="h-11 w-36" />
        <Skeleton className="mt-6 h-4 w-32" />
        <Skeleton className="mt-3 h-10 w-64 max-w-full" />
        <Skeleton className="mt-4 h-6 w-56 max-w-full" />
        <Skeleton className="mt-10 h-5 w-48" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="mt-8 h-5 w-36" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="mt-8 h-40 w-full" />
      </LoadingRegion>
    </DesignSystem>
  );
}
