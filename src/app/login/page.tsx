"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { collegeConfig } from "../../../college.config";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8 shadow-2xl text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">
            Student Project Hub
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {collegeConfig.name}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-danger-500/10 border border-danger-500/30 p-3 text-xs text-danger-400 text-left">
            <span className="font-semibold block mb-1">Authentication Notice:</span>
            {error === "auth_failed"
              ? "Unable to complete Google sign-in. Please ensure your Google account is configured in Google Cloud Console."
              : decodeURIComponent(error)}
          </div>
        )}

        <div>
          <button
            onClick={handleGoogleSignIn}
            className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-500 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </div>

        <p className="text-xs text-neutral-400">
          Institutional access for students and faculty.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
