"use client";

import React from "react";
import { Button } from "@/components/ui/Button";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-8 shadow-2xl text-center space-y-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-danger-500/10 border border-danger-500/30 text-danger-400 text-2xl">
            ⚠️
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Application Error</h1>
            <p className="text-sm text-neutral-400">
              A critical error interrupted the application. Please try reloading or returning home.
            </p>
            {error.digest && (
              <p className="text-xs font-mono text-neutral-500 pt-1">
                Incident Ref: {error.digest}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => (window.location.href = "/")}>
              Home
            </Button>
            <Button variant="primary" onClick={() => reset()}>
              Reload
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
