"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { collegeConfig } from "../../../college.config";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  const attemptedEmail = searchParams.get("email");
  const [loading, setLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<React.ReactNode | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
      const canonicalOrigin = configuredSiteUrl
        ? new URL(configuredSiteUrl).origin
        : window.location.origin;

      // OAuth state is stored in a same-origin cookie. Start the flow and receive
      // its callback on the configured canonical host to avoid localhost/127.0.0.1
      // or preview/production host mismatches.
      if (window.location.origin !== canonicalOrigin) {
        window.location.replace(`${canonicalOrigin}/login`);
        return;
      }

      setActionError(null);
      setLoading(true);
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${canonicalOrigin}/auth/callback`,
        },
      });

      if (signInError) {
        console.error("Sign in error:", signInError);
        setActionError("We couldn’t start Google sign-in. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error("OAuth exception:", err);
      setActionError("We couldn’t start Google sign-in. Please try again.");
      setLoading(false);
    }
  };

  const isUnauthorizedDomain =
    error === "unauthorized_domain" ||
    error === "invalid_domain" ||
    errorDescription?.toLowerCase().includes("unauthorized_domain") ||
    errorDescription?.toLowerCase().includes("invalid college pattern");

  const getErrorMessage = (): React.ReactNode => {
    if (isUnauthorizedDomain) {
      return (
        <div>
          <p className="font-semibold text-red-900">
            Access Restricted to {collegeConfig.name}
          </p>
          <p className="mt-1 text-xs leading-5 text-red-700">
            {attemptedEmail ? (
              <>
                The Google account <span className="font-mono font-semibold text-red-900">{attemptedEmail}</span> is not an authorized Rajalakshmi Engineering College email.
              </>
            ) : (
              <>
                Only verified <code className="rounded bg-red-100 px-1 py-0.5 font-semibold text-red-900">@{collegeConfig.domain}</code> accounts are allowed to log in.
              </>
            )}
          </p>
          <p className="mt-2 text-xs font-semibold text-red-800">
            Please switch to your college Google account and try again.
          </p>
        </div>
      );
    }

    const rawError = errorDescription || error;
    if (errorCode === "flow_state_already_used" || rawError?.includes("already been used")) {
      return "Your previous sign-in attempt timed out or was already used. Please click 'Continue with Google' to start a fresh login.";
    }
    if (rawError?.includes("PKCE") || rawError?.includes("code verifier")) {
      return "Your sign-in session could not be verified. Start again in the same browser tab and use the app’s configured address. In Supabase Auth URL Configuration, make sure the Site URL and allowed redirect URL include this app’s exact address and /auth/callback.";
    }
    if (error === "auth_failed") {
      return "Unable to complete Google sign-in. Please ensure your Google account is configured in Google Cloud Console.";
    }
    if (!rawError) return null;
    try {
      return decodeURIComponent(rawError);
    } catch {
      return rawError;
    }
  };

  const displayError = actionError || getErrorMessage();

  return (
    <main className="relative flex h-dvh items-center justify-center overflow-hidden bg-[#f4f7f5] p-4 text-[#112217] sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#d8f3dc]/70 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-[#c9e7d2]/60 blur-3xl" />

      <div className="relative grid max-h-full w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[#dce8df] bg-white shadow-[0_30px_90px_-35px_rgba(10,34,21,0.3)] md:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#0a2215] p-10 text-white md:flex md:flex-col md:justify-between lg:p-12">
          <div aria-hidden="true" className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-emerald-200/10 bg-emerald-300/5" />
          <div aria-hidden="true" className="absolute -bottom-32 -left-28 h-96 w-96 rounded-full border border-emerald-200/10 bg-emerald-300/5" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#74c69d] ring-1 ring-white/10">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path d="M12 21V11m0 4c0-4.5 2.7-7.5 7-9-0.2 4.9-2.6 8-7 9Zm0-2c0-3.5-2.3-6.1-6.5-7.2.1 4.2 2.4 7.1 6.5 7.2Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">Student Project Hub</p>
              <p className="text-xs text-emerald-100/65">{collegeConfig.name}</p>
            </div>
          </div>

          <div className="relative z-10 py-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-[#74c69d]" />
              Ideas grow better together
            </span>
            <h2 className="mt-6 max-w-md text-4xl font-extrabold leading-[1.12] tracking-tight lg:text-5xl">
              Find your people. <span className="text-[#74c69d]">Build what matters.</span>
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-emerald-50/70">
              Meet teammates, shape your ideas, and turn campus projects into something real.
            </p>

            <div className="mt-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#74c69d]/15 text-[#9ae6b4]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold">One place for your next big idea</p>
                <p className="mt-0.5 text-xs text-emerald-50/60">Projects · teams · shared progress</p>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-xs text-emerald-100/50">Learn · Build · Grow</p>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14" aria-labelledby="login-title">
          <div className="w-full max-w-sm space-y-8">
            <div className="md:hidden">
              <p className="text-sm font-bold text-[#143d28]">Student Project Hub</p>
              <p className="mt-1 text-xs text-[#6a8475]">{collegeConfig.name}</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-[#31754b]">Welcome to your project hub</p>
              <h1 id="login-title" className="mt-2 text-3xl font-extrabold tracking-tight text-[#112217] sm:text-4xl">
                Sign in
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#607568]">
                Use your institutional Google account to continue.
              </p>
            </div>

            {displayError && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 mt-0.5">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    {!isUnauthorizedDomain && <span className="mb-1 block font-semibold">We couldn’t sign you in</span>}
                    {displayError}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                aria-busy={loading}
                className="group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#143d28] px-5 py-4 text-sm font-bold text-white shadow-[0_12px_24px_-12px_rgba(20,61,40,0.65)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#1e5338] hover:shadow-[0_16px_28px_-12px_rgba(20,61,40,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31754b] focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70 motion-reduce:transform-none"
              >
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84Z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
                  </svg>
                )}
                {loading ? "Connecting to Google…" : "Continue with Google"}
              </button>
              <p className="text-center text-xs leading-5 text-[#718579]">
                Secure institutional access for students and faculty.
              </p>
            </div>

            <div className="border-t border-[#e5ede7] pt-5 text-center">
              <Link href="/privacy" className="text-xs font-medium text-[#52715e] underline-offset-4 hover:text-[#143d28] hover:underline">
                Privacy and access information
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center overflow-hidden bg-[#f4f7f5] text-sm font-medium text-[#52715e]">Loading your sign-in page…</div>}>
      <LoginContent />
    </Suspense>
  );
}
