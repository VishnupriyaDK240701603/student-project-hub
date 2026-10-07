"use client";

import React from "react";
import { Button } from "@/components/ui/Button";

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-12.728 0m0 0l2.829-2.829m-2.829 2.829L3 21m2.828-12.536a5 5 0 017.072 0m0 0l-2.829 2.829"
            />
          </svg>
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-slate-100">
          You are currently offline
        </h1>

        <p className="mt-2.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Student Project Hub requires an active internet connection to securely sync your teams, messages, and project tasks.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={handleRetry} variant="primary" className="w-full">
            Retry Connection
          </Button>
        </div>

        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
          Your cached static shell is loaded, but room data is never stored locally for security and privacy.
        </p>
      </div>
    </main>
  );
}
