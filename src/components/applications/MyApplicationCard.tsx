"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button, useToast } from "@/components/ui";
import { CountdownBadge } from "@/components/invites/CountdownBadge";
import { ResumePreviewModal } from "@/components/applications/ResumePreviewModal";
import { withdrawApplication, type MyApplicationItem } from "@/server/actions/applications";
import { acceptInviteAction, declineInviteAction } from "@/server/actions/invites";
import { collegeConfig } from "../../../college.config";

interface MyApplicationCardProps {
  application: MyApplicationItem;
  onRefresh: () => void;
}

export const MyApplicationCard: React.FC<MyApplicationCardProps> = ({
  application,
  onRefresh,
}) => {
  const { showToast } = useToast();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const request = application.team_requests;
  const files = application.application_files || [];
  const status = application.status;
  const leadName = request?.profiles?.display_name || "Project Lead";
  const leadDept = request?.profiles?.department || request?.department || "CSE";

  const getDeptName = (code: string) =>
    collegeConfig.departments?.[code.toLowerCase()] || code.toUpperCase();

  const handleWithdraw = async () => {
    if (!confirm("Are you sure you want to withdraw your application? This cannot be undone.")) {
      return;
    }
    setLoadingAction("withdraw");
    const res = await withdrawApplication(application.id);
    setLoadingAction(null);

    if (res.success) {
      showToast({
        type: "success",
        title: "Application Withdrawn",
        description: "Your application has been safely removed.",
      });
      onRefresh();
    } else {
      showToast({
        type: "error",
        title: "Withdrawal Failed",
        description: res.error || "Could not withdraw application.",
      });
    }
  };

  const handleAccept = async () => {
    setLoadingAction("accept");
    const res = await acceptInviteAction(application.id);
    setLoadingAction(null);

    if (res.success) {
      showToast({
        type: "success",
        title: "Invite Accepted! 🎉",
        description: "Welcome to the team! Your project room is ready.",
      });
      onRefresh();
    } else {
      showToast({
        type: "error",
        title: "Could Not Accept",
        description: res.error || "This spot is no longer available.",
      });
    }
  };

  const handleDecline = async () => {
    if (!confirm("Are you sure you want to decline this project invitation?")) return;
    setLoadingAction("decline");
    const res = await declineInviteAction(application.id);
    setLoadingAction(null);

    if (res.success) {
      showToast({
        type: "info",
        title: "Invite Declined",
        description: "You have declined this project invitation.",
      });
      onRefresh();
    } else {
      showToast({
        type: "error",
        title: "Action Failed",
        description: res.error || "Could not decline invite.",
      });
    }
  };

  const renderStatusBadge = () => {
    switch (status) {
      case "applied":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Under Lead Review
          </span>
        );
      case "selected":
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 animate-bounce">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Invite Received! 🎉
            </span>
            {application.expires_at && (
              <CountdownBadge expiresAt={application.expires_at} />
            )}
          </div>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Official Member 🚀
          </span>
        );
      case "waitlisted":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            On Waiting List
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800">
            Not Selected
          </span>
        );
      case "withdrawn":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-800">
            Withdrawn
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
            Invite Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
            {status}
          </span>
        );
    }
  };

  const formattedDate = new Date(application.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-white dark:bg-[#0e2016] rounded-3xl p-6 border border-[#e3eae5] dark:border-[#1a3525] flex flex-col justify-between text-left h-full shadow-[0_2px_10px_-2px_rgba(10,34,21,0.04)] hover:shadow-[0_12px_30px_-6px_rgba(10,34,21,0.08)] dark:hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.4)] transition-all duration-200 group">
      <div className="space-y-4">
        {/* Top Status & Date */}
        <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
          {renderStatusBadge()}
          <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
            Applied {formattedDate}
          </span>
        </div>

        {/* Project Title */}
        <div>
          <h3 className="text-lg font-extrabold tracking-tight text-[#112217] dark:text-[#f4fbf6] group-hover:text-[#143d28] dark:group-hover:text-[#52b788] transition-colors leading-snug">
            {request?.id ? (
              <Link href={`/requests/${request.id}`} className="hover:underline">
                {request.title}
              </Link>
            ) : (
              "Project Request"
            )}
          </h3>

          {/* Role & Dept */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ea580c] dark:text-[#fb923c] uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-[#ea580c]" />
              Role: {request?.role_needed || "Teammate"}
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">&bull;</span>
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
              {getDeptName(leadDept)}
            </span>
          </div>
        </div>

        {/* Lead Profile Banner */}
        <div className="p-3 rounded-2xl bg-[#f7faf8] dark:bg-[#12241a] border border-[#e8efe9] dark:border-[#1d3a2b] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0a2215] text-[#86efac] font-bold text-xs flex items-center justify-center">
              {leadName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-[#112217] dark:text-[#f4fbf6]">{leadName}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Project Lead</p>
            </div>
          </div>
          {request?.status && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              request.status === "open"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
            }`}>
              Request {request.status}
            </span>
          )}
        </div>

        {/* Note preview if provided */}
        {application.note && (
          <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/70 dark:border-neutral-800 text-xs space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Your Note to Lead</p>
            <p className="text-neutral-700 dark:text-neutral-300 italic line-clamp-2">&ldquo;{application.note}&rdquo;</p>
          </div>
        )}

        {/* Attached Resumes / Files */}
        {files.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Attached Documents</p>
            <div className="flex items-center gap-2 flex-wrap">
              {files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setActiveFileId(f.id);
                    setIsPreviewOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>View Resume</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-6 pt-4 border-t border-[#e8efe9] dark:border-[#1d3a2b] flex items-center justify-between gap-2 flex-wrap">
        {status === "selected" ? (
          <div className="flex items-center gap-2 w-full">
            <Button
              variant="primary"
              size="sm"
              onClick={handleAccept}
              disabled={Boolean(loadingAction)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-xs py-2 font-bold"
            >
              {loadingAction === "accept" ? "Joining..." : "Accept Invite 🎉"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDecline}
              disabled={Boolean(loadingAction)}
              className="text-xs py-2 text-rose-600 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              Decline
            </Button>
          </div>
        ) : status === "accepted" ? (
          <div className="flex items-center justify-between w-full gap-2">
            <Link href="/rooms" className="flex-1">
              <Button
                variant="primary"
                size="sm"
                className="w-full bg-[#0a2215] hover:bg-[#143d28] dark:bg-[#1e4e33] dark:hover:bg-[#286643] text-xs py-2 font-bold"
              >
                Go to Team Room 🚀
              </Button>
            </Link>
            {request?.id && (
              <Link href={`/requests/${request.id}`}>
                <Button variant="outline" size="sm" className="text-xs py-2">
                  Details
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between w-full gap-2">
            {request?.id && (
              <Link href={`/requests/${request.id}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs py-2">
                  View Project Details &rarr;
                </Button>
              </Link>
            )}
            {(status === "applied" || status === "waitlisted") && (
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={Boolean(loadingAction)}
                className="text-xs font-semibold text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors px-2 py-1 cursor-pointer disabled:opacity-50"
              >
                {loadingAction === "withdraw" ? "Withdrawing..." : "Withdraw"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Resume Preview Modal */}
      <ResumePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setActiveFileId(null);
        }}
        fileId={activeFileId}
        candidateName="My Submitted Resume"
        candidateDepartment={getDeptName(request?.department || "")}
        candidateNote={application.note}
      />
    </div>
  );
};
