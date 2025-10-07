import { Skeleton } from '@/components/ui/Skeleton';

export function AgentCardSkeleton() {
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <div className="ml-4">
              <div className="flex items-center">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="ml-2 h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function AgentGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="ml-3">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-3/4 mb-4" />
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}