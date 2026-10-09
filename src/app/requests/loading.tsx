import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export default function RequestsLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 max-w-7xl mx-auto space-y-6">
      {/* Banner Skeleton */}
      <div className="rounded-3xl bg-slate-900/80 p-8 space-y-4 border border-slate-800 shimmer">
        <Skeleton className="h-6 w-36 rounded-full" />
        <Skeleton className="h-8 w-2/3 rounded-lg" />
        <Skeleton className="h-4 w-1/2 rounded" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between gap-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>

      {/* Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shimmer">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-6 w-3/4 rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <div className="flex gap-2 pt-2">
              <Skeleton rounded="full" className="h-8 w-8" />
              <Skeleton className="h-4 w-1/3 my-auto rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
