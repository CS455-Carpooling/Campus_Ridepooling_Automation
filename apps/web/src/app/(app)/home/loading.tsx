import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';

/** Skeleton in the shape of the home page, shown while it loads. */
export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <LoadingRegion label="Loading your home page">
        <Skeleton className="h-10 w-48" />
        <div className="mt-6 flex flex-wrap gap-3">
          <Skeleton className="h-11 w-32" />
          <Skeleton className="h-11 w-32" />
        </div>
        <Skeleton className="mt-10 h-7 w-32" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </LoadingRegion>
    </div>
  );
}
