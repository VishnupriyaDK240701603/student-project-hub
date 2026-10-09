import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export default function RoomsLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shimmer">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-6 w-3/4 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
