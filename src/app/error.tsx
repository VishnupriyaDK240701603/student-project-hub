"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log sanitized error with request digest to telemetry
    console.error("Client Error Boundary captured error:", {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-8 shadow-2xl text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-danger-500/10 border border-danger-500/30 text-danger-400 text-2xl">
          ⚠️
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-neutral-100">Something went wrong</h2>
          <p className="text-sm text-neutral-400">
            An unexpected error occurred while processing your request. Our technical team has been notified.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-neutral-500 pt-1">
              Reference ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            Go Home
          </Button>
          <Button variant="primary" onClick={() => reset()}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
