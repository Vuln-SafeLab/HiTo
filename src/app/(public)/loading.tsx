import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <div className="flex flex-col gap-6 pb-10 pt-16 sm:pt-24">
        <Skeleton className="h-16 w-full max-w-2xl sm:h-20" />
        <Skeleton className="h-5 w-full max-w-md" />
        <Skeleton className="h-11 w-full max-w-md" />
      </div>
      <div className="flex gap-2 pb-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 pb-20 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-card border border-border">
            <Skeleton className="aspect-[16/10] w-full rounded-none" />
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
