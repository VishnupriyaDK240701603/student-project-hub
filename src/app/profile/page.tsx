"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collegeConfig } from "../../../college.config";
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
  const [kind, setKind] = useState<"student" | "staff">("student");
  const [admissionYear, setAdmissionYear] = useState<number>(2023);
  const [department, setDepartment] = useState<string>("CSE");
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
      setDisplayName(data.display_name || "");
      setKind(data.kind || "student");
      setAdmissionYear(data.admission_year || 2023);
      setDepartment(data.department || "CSE");
      setGender((data.gender as GenderEnum) || "prefer_not_to_say");
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
          kind,
          admission_year: kind === "student" ? admissionYear : null,
          department: department.toUpperCase(),
          gender,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              display_name: displayName.trim(),
              kind,
              admission_year: kind === "student" ? admissionYear : null,
              department: department.toUpperCase(),
              gender,
            }
          : null,
      );

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
      <main className="flex h-dvh items-center justify-center bg-[#f4f7f5] text-sm font-medium text-[#52715e] dark:bg-[#08150e] dark:text-[#a5c0b0]">
        <div>Loading profile...</div>
      </main>
    );
  }

  return (
    <main className="relative flex h-dvh items-center justify-center overflow-hidden bg-[#f4f7f5] p-3 text-[#112217] dark:bg-[#08150e] dark:text-[#f4fbf6] sm:p-5">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-[#d8f3dc]/70 blur-3xl dark:bg-[#2d6a4f]/20" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-[#c9e7d2]/60 blur-3xl dark:bg-[#52b788]/10" />
      <form
        onSubmit={handleSave}
        className="relative grid max-h-full w-full max-w-4xl grid-cols-2 gap-x-4 gap-y-3 overflow-hidden rounded-[1.75rem] border border-[#dce8df] bg-white p-5 shadow-[0_30px_90px_-35px_rgba(10,34,21,0.3)] dark:border-[#1a3525] dark:bg-[#0e2016] sm:gap-x-6 sm:gap-y-4 sm:p-8"
      >
        <div className="col-span-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#31754b] dark:text-[#74c69d]">Student Project Hub</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#112217] dark:text-[#f4fbf6]">
            Profile Settings
          </h1>
          <p className="mt-1 text-xs text-[#607568] dark:text-[#a5c0b0]">
            Keep your details up to date so the right teammates can find you.
          </p>
        </div>

        {error && (
          <div role="alert" className="col-span-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
            Profile updated successfully.
          </div>
        )}

        {/* Email */}
        <div className="col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#718579] dark:text-[#a5c0b0]">
            College email
          </label>
          <p className="mt-1 truncate rounded-xl border border-[#dce8df] bg-[#f4f7f5] px-3 py-2.5 text-sm font-medium text-[#42594b] dark:border-[#274333] dark:bg-[#14281d] dark:text-[#c8d8ce]">
            {profile?.email}
          </p>
        </div>

        {/* Account Role */}
        <div>
          <label htmlFor="profileKind" className="block text-xs font-semibold text-[#42594b] dark:text-[#c8d8ce]">
            Account role
          </label>
          <select
            id="profileKind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "student" | "staff")}
            className="mt-1 block w-full rounded-xl border border-[#d7e4db] bg-white px-3 py-2.5 text-sm text-[#112217] outline-none transition focus:border-[#31754b] focus:ring-2 focus:ring-[#31754b]/15 dark:border-[#274333] dark:bg-[#102419] dark:text-[#f4fbf6]"
          >
            <option value="student">Student</option>
            <option value="staff">Staff / Faculty</option>
          </select>
        </div>

        {/* Year of Admission (Only for students) */}
        {kind === "student" && (
          <div>
            <label htmlFor="admissionYear" className="block text-xs font-semibold text-[#42594b] dark:text-[#c8d8ce]">
              Admission year
            </label>
            <select
              id="admissionYear"
              value={admissionYear}
              onChange={(e) => setAdmissionYear(Number(e.target.value))}
              className="mt-1 block w-full rounded-xl border border-[#d7e4db] bg-white px-3 py-2.5 text-sm text-[#112217] outline-none transition focus:border-[#31754b] focus:ring-2 focus:ring-[#31754b]/15 dark:border-[#274333] dark:bg-[#102419] dark:text-[#f4fbf6]"
            >
              {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((yr) => (
                <option key={yr} value={yr}>
                  Batch {yr} (Class of {yr + 4})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Department */}
        <div>
          <label htmlFor="profileDept" className="block text-xs font-semibold text-[#42594b] dark:text-[#c8d8ce]">
            Department
          </label>
          <select
            id="profileDept"
            value={department.toLowerCase()}
            onChange={(e) => setDepartment(e.target.value.toUpperCase())}
            className="mt-1 block w-full rounded-xl border border-[#d7e4db] bg-white px-3 py-2.5 text-sm text-[#112217] outline-none transition focus:border-[#31754b] focus:ring-2 focus:ring-[#31754b]/15 dark:border-[#274333] dark:bg-[#102419] dark:text-[#f4fbf6]"
          >
            {Object.entries(collegeConfig.departments || {}).map(([code, name]) => (
              <option key={code} value={code.toLowerCase()}>
                {code.toUpperCase()} — {name}
              </option>
            ))}
          </select>
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="profileDisplayName" className="block text-xs font-semibold text-[#42594b] dark:text-[#c8d8ce]">
            Display name
          </label>
          <input
            id="profileDisplayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            required
            className="mt-1 block w-full rounded-xl border border-[#d7e4db] bg-white px-3 py-2.5 text-sm text-[#112217] outline-none transition focus:border-[#31754b] focus:ring-2 focus:ring-[#31754b]/15 dark:border-[#274333] dark:bg-[#102419] dark:text-[#f4fbf6]"
          />
        </div>

        {/* Gender */}
        <div>
          <label htmlFor="profileGender" className="block text-xs font-semibold text-[#42594b] dark:text-[#c8d8ce]">
            Gender preference
          </label>
          <select
            id="profileGender"
            value={gender}
            onChange={(e) => setGender(e.target.value as GenderEnum)}
            className="mt-1 block w-full rounded-xl border border-[#d7e4db] bg-white px-3 py-2.5 text-sm text-[#112217] outline-none transition focus:border-[#31754b] focus:ring-2 focus:ring-[#31754b]/15 dark:border-[#274333] dark:bg-[#102419] dark:text-[#f4fbf6]"
          >
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#143d28] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_22px_-12px_rgba(20,61,40,0.8)] transition hover:bg-[#1e5338] disabled:cursor-wait disabled:opacity-60 dark:bg-[#2d6a4f] dark:hover:bg-[#3c8061]"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-xl border border-[#d7e4db] px-4 py-2.5 text-sm font-semibold text-[#52715e] transition hover:bg-[#f4f7f5] dark:border-[#274333] dark:text-[#a5c0b0] dark:hover:bg-[#14281d]"
          >
            Sign out
          </button>
        </div>
      </form>
    </main>
  );
}
