"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { GenderEnum } from "@/types/database.types";

const GENDER_OPTIONS: { value: GenderEnum; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const PRIVACY_NOTICE_VERSION = "v1";

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<GenderEnum>("prefer_not_to_say");
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) {
      setError("You must accept the privacy notice to continue.");
      return;
    }
    if (!displayName.trim() || displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Session expired. Please sign in again.");
        router.push("/login");
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          gender,
          consent_version: PRIVACY_NOTICE_VERSION,
          consent_given_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.push("/");
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-lg"
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Complete Your Profile
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Set your display name and preferences to get started.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Display Name */}
        <div className="mt-6">
          <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            required
            className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="Your preferred name"
          />
        </div>

        {/* Gender Selection */}
        <div className="mt-4">
          <label htmlFor="gender" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Gender
          </label>
          <select
            id="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as GenderEnum)}
            className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            This can be changed anytime in your profile settings.
          </p>
        </div>

        {/* Privacy Notice Consent */}
        <div className="mt-6 rounded-lg bg-slate-50 dark:bg-slate-800 p-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Privacy Notice</h2>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            By using Student Project Hub, you agree that your profile information (name, email, year,
            department, and gender preference) is visible to other verified campus users as needed for
            team formation. Your resumes and room conversations are private and shared only with
            designated team members. The @ai feature sends room context to a third-party model provider
            (Hugging Face) for processing. You may update your gender and display name at any time.
          </p>
          <label className="mt-3 flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              I have read and accept the privacy notice (version {PRIVACY_NOTICE_VERSION}).
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !consentChecked}
          className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </form>
    </main>
  );
}
