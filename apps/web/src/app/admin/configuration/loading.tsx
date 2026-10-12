import { DesignSystem } from '@/components/ui/DesignSystem';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';

/** Skeleton in the shape of the configuration pages, shown while they load. */
export default function ConfigurationLoading() {
  return (
    <DesignSystem className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <LoadingRegion label="Loading the configuration">
        <div className="flex flex-wrap justify-between gap-3 border-b border-line pb-4">
          <Skeleton className="h-11 w-96 max-w-full" />
          <Skeleton className="h-11 w-28" />
        </div>
        <Skeleton className="mt-6 h-11 w-40" />
        <Skeleton className="mt-4 h-10 w-72 max-w-full" />
        <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        <Skeleton className="mt-10 h-7 w-48" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="mt-6 h-48 w-full" />
      </LoadingRegion>
    </DesignSystem>
  );
}
