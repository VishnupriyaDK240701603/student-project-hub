import React, { useState } from "react";
import Link from "next/link";
import { admissionYearToStudyLevel, getStudyLevelLabel } from "@/lib/academic-year";
import { collegeConfig } from "../../../college.config";
import type { TeamRequest } from "@/types/database.types";

export interface RequestCardProps {
  request: TeamRequest & {
    profiles?: {
      display_name: string;
      department: string;
      admission_year: number | null;
    } | null;
  };
  isLead?: boolean;
  currentUserId?: string | null;
  onClose?: (id: string) => void;
  onApply?: (id: string) => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  request,
  isLead: propsIsLead = false,
  currentUserId,
  onApply,
}) => {
  const [bookmarked, setBookmarked] = useState(false);
  const leadName = request.profiles?.display_name || "Lead Student";
  const leadDept = request.profiles?.department || "CSE";
  const isOpen = request.status === "open";

  const initials = leadName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "LS";

  // Strict invariant: User is lead if lead_id matches current user ID or if propsIsLead is set
  const isLead = Boolean(currentUserId && request.lead_id === currentUserId) || propsIsLead;

  // Format department code to full name if available
  const getDeptName = (code: string) =>
    collegeConfig.departments?.[code.toLowerCase()] || code.toUpperCase();

  // Subtle pastel tag colors
  const tagColorClasses = [
    "bg-emerald-50 text-emerald-800 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
    "bg-purple-50 text-purple-800 border-purple-200/70 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40",
    "bg-blue-50 text-blue-800 border-blue-200/70 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40",
    "bg-amber-50 text-amber-800 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
  ];

  return (
    <div className="bg-white dark:bg-[#0e2016] rounded-3xl p-6 border border-[#e3eae5] dark:border-[#1a3525] flex flex-col justify-between text-left h-full shadow-[0_2px_10px_-2px_rgba(10,34,21,0.04)] hover:shadow-[0_12px_30px_-6px_rgba(10,34,21,0.08)] dark:hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.4)] transition-all duration-200 group">
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Spots Open Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#e8f6ed] text-[#14532d] dark:bg-[#143322] dark:text-[#86efac] border border-[#bbf7d0] dark:border-[#1e4e33]">
              <span className="h-2 w-2 rounded-full bg-[#16a34a] animate-pulse" />
              {isOpen ? `${request.headcount} Spots Open` : request.status.toUpperCase()}
            </span>

            {/* Resume Required Badge */}
            {request.resume_required && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#f3e8ff] text-[#7e22ce] dark:bg-[#2e1065] dark:text-[#d8b4fe] border border-[#e9d5ff] dark:border-[#581c87]">
                📄 Resume
              </span>
            )}

            {/* Hot tag */}
            {request.headcount > 2 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ffedd5] text-[#c2410c] dark:bg-[#431407] dark:text-[#fdba74] border border-[#fed7aa] dark:border-[#9a3412]">
                🔥 HOT
              </span>
            )}
          </div>

          {isLead && (
            <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-[#1b4332] text-white">
              Your Project
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-extrabold tracking-tight text-[#112217] dark:text-[#f4fbf6] group-hover:text-[#143d28] dark:group-hover:text-[#52b788] transition-colors leading-snug">
          <Link href={`/requests/${request.id}`} className="hover:underline">
            {request.title}
          </Link>
        </h3>

        {/* Seeking Role */}
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#ea580c]" />
          <p className="text-xs font-extrabold text-[#ea580c] tracking-wider uppercase">
            SEEKING: {request.role_needed}
          </p>
        </div>

        {/* Description */}
        <p className="mt-2.5 text-xs text-[#4b6354] dark:text-[#a0b8aa] line-clamp-3 leading-relaxed">
          {request.description}
        </p>

        {/* Skill Tags */}
        {request.tags && request.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {request.tags.slice(0, 5).map((tag, idx) => (
              <span
                key={tag}
                className={`text-xs font-bold px-3 py-1 rounded-full border transition-transform hover:scale-105 ${
                  tagColorClasses[idx % tagColorClasses.length]
                }`}
              >
                #{tag}
              </span>
            ))}
            {request.tags.length > 5 && (
              <span className="text-xs font-medium text-[#7a9485] self-center">
                +{request.tags.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Eligibility Container */}
        <div className="mt-5 text-xs bg-[#f4f7f5] dark:bg-[#14281d] p-3.5 rounded-2xl border border-[#e3eae5] dark:border-[#1d3d2a] space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#52796f] dark:text-[#74c69d]">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              ELIGIBILITY FILTER
            </span>
            <span className="flex items-center gap-1 text-[#16a34a] dark:text-[#86efac]">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              REC VERIFIED
            </span>
          </div>
          <div className="space-y-1 text-[#2d4034] dark:text-[#c4dbcd] pt-0.5">
            <div>
              <strong className="text-[#143d28] dark:text-[#a7d7ba] font-bold">Years:</strong>{" "}
              {request.filter_years && request.filter_years.length > 0
                ? request.filter_years
                    .map((y) => getStudyLevelLabel(admissionYearToStudyLevel(y)))
                    .join(", ")
                : "All Years"}
            </div>
            <div>
              <strong className="text-[#143d28] dark:text-[#a7d7ba] font-bold">Depts:</strong>{" "}
              {request.filter_departments && request.filter_departments.length > 0
                ? request.filter_departments.map(getDeptName).join(", ")
                : "All Departments"}
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="flex items-center justify-between gap-3 pt-4 mt-5 border-t border-[#e3eae5] dark:border-[#1a3525]">
        {/* Creator Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-full bg-[#e8f1ec] dark:bg-[#1a3828] border border-[#b7d5c3] dark:border-[#2d573f] flex items-center justify-center font-bold text-xs text-[#143d28] dark:text-[#86efac] flex-shrink-0">
            {initials}
          </div>
          <div className="text-xs leading-tight truncate">
            <p className="font-bold text-[#112217] dark:text-[#f4fbf6] truncate">{leadName}</p>
            <p className="text-[#6c8777] dark:text-[#8fa899] text-[11px] truncate">{leadDept}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isLead ? (
            <Link href={`/requests/${request.id}`}>
              <button
                type="button"
                className="text-xs bg-[#143d28] hover:bg-[#1e5338] text-white px-4 py-2 rounded-full font-bold transition-all shadow-sm cursor-pointer"
              >
                {isOpen ? "Manage & Finalize" : "View Team Room"}
              </button>
            </Link>
          ) : (
            isOpen && (
              <button
                type="button"
                onClick={() => onApply?.(request.id)}
                className="inline-flex items-center gap-1.5 text-xs bg-[#0b2719] hover:bg-[#134029] text-white font-bold px-4 py-2 rounded-full transition-all shadow-sm hover:scale-[1.02] cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 rotate-45 transform -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Apply Now
              </button>
            )
          )}

          {/* Bookmark Action */}
          <button
            type="button"
            onClick={() => setBookmarked(!bookmarked)}
            aria-label="Save project"
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              bookmarked
                ? "text-[#143d28] bg-emerald-100/70 dark:bg-[#1b4332] dark:text-emerald-300"
                : "text-[#8fa899] hover:text-[#112217] dark:hover:text-white hover:bg-[#e8f1ec] dark:hover:bg-[#142d20]"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill={bookmarked ? "currentColor" : "none"}
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

