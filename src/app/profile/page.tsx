"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { GenderEnum } from "@/types/database.types";

const GENDER_OPTIONS: { value: GenderEnum; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

interface ProfileData {
  email: string;
  display_name: string;
  kind: "student" | "staff";
  admission_year: number | null;
  department: string;
  gender: GenderEnum;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<GenderEnum>("prefer_not_to_say");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("email, display_name, kind, admission_year, department, gender")
        .eq("id", user.id)
        .single();

      if (fetchError || !data) {
        setError("Failed to load profile.");
        setLoading(false);
        return;
      }

      setProfile(data as ProfileData);
      setDisplayName(data.display_name);
      setGender(data.gender as GenderEnum);
      setLoading(false);
    };
    loadProfile();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || displayName.trim().length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          gender,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-slate-500">Loading profile...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-8 pt-16">
      <form
        onSubmit={handleSave}
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-lg"
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Profile
        </h1>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            Profile updated successfully.
          </div>
        )}

        {/* Read-Only Fields */}
        <div className="mt-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Email</label>
            <p className="text-sm text-slate-900 dark:text-slate-100">{profile?.email}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Account Type</label>
            <p className="text-sm text-slate-900 dark:text-slate-100 capitalize">{profile?.kind}</p>
          </div>
          {profile?.kind === "student" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Year of Admission</label>
              <p className="text-sm text-slate-900 dark:text-slate-100">{profile?.admission_year}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Department</label>
            <p className="text-sm text-slate-900 dark:text-slate-100">{profile?.department}</p>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-6">
          <div>
            <label htmlFor="profileDisplayName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Display Name
            </label>
            <input
              id="profileDisplayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              required
              className="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="mt-4">
            <label htmlFor="profileGender" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Gender
            </label>
            <select
              id="profileGender"
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
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Sign Out
        </button>
      </form>
    </main>
  );
}
