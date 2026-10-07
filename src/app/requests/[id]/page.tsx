"use client";

import React, { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import {
  Badge,
  Chip,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Avatar,
  useToast,
} from "@/components/ui";
import { ApplyModal } from "@/components/applications/ApplyModal";
import { SelectApplicantModal } from "@/components/invites/SelectApplicantModal";
import { RaiseHeadcountModal } from "@/components/invites/RaiseHeadcountModal";
import { ReplaceMemberModal } from "@/components/invites/ReplaceMemberModal";
import { CreateFollowUpRequestModal } from "@/components/requests/CreateFollowUpRequestModal";
import { CountdownBadge } from "@/components/invites/CountdownBadge";
import { createClient } from "@/lib/supabase/client";
import { admissionYearToStudyLevel, getStudyLevelLabel } from "@/lib/academic-year";
import {
  withdrawApplication,
  getApplicationsForRequest,
  getSecureFileDownloadUrl,
  type ApplicationWithDetails,
} from "@/server/actions/applications";
import {
  waitlistApplicant,
  rejectApplicant,
  acceptInviteAction,
  declineInviteAction,
} from "@/server/actions/invites";
import { closeRequestAction } from "@/server/actions/rooms";
import { collegeConfig } from "../../../../college.config";
import type { TeamRequest, Application, ApplicationFile } from "@/types/database.types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RequestDetailsPage({ params }: PageProps) {
  const { showToast } = useToast();
  const resolvedParams = use(params);
  const requestId = resolvedParams.id;

  const [request, setRequest] = useState<TeamRequest | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leadProfile, setLeadProfile] = useState<{
    display_name: string;
    department: string;
    admission_year: number | null;
  } | null>(null);

  // Application states
  const [myApplication, setMyApplication] = useState<
    (Application & { application_files?: ApplicationFile[] }) | null
  >(null);
  const [leadApplications, setLeadApplications] = useState<ApplicationWithDetails[]>([]);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lead modal states
  const [selectedAppForInvite, setSelectedAppForInvite] = useState<ApplicationWithDetails | null>(
    null,
  );
  const [isRaiseHeadcountOpen, setIsRaiseHeadcountOpen] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoomMembers, setActiveRoomMembers] = useState<
    Array<{ id: string; user_id: string; role: string; profiles?: { display_name: string; department: string } }>
  >([]);
  const [memberToReplace, setMemberToReplace] = useState<ApplicationWithDetails | null>(null);
  const [leadTab, setLeadTab] = useState<"applied" | "selected" | "waitlisted" | "accepted" | "all">("applied");

  const fetchRequestDetails = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);

    const { data, error: fetchError } = await supabase
      .from("team_requests")
      .select("*, profiles:lead_id(display_name, department, admission_year)")
      .eq("id", requestId)
      .single();

    if (fetchError || !data) {
      setError(
        fetchError?.message ||
          "This request could not be found or you may not be eligible to view it based on department, year, or gender filters.",
      );
      setLoading(false);
      return;
    }

    setRequest(data as unknown as TeamRequest);
    if (data.profiles) {
      setLeadProfile(
        data.profiles as unknown as {
          display_name: string;
          department: string;
          admission_year: number | null;
        },
      );
    }

    // Resolve room details if request is full, closed, or linked follow-up
    let targetRoomId = (data as TeamRequest).room_id || null;
    if (!targetRoomId && (data.status === "full" || data.status === "closed")) {
      const { data: rm } = await supabase
        .from("rooms")
        .select("id")
        .eq("request_id", requestId)
        .maybeSingle();
      if (rm) targetRoomId = rm.id;
    }
    setActiveRoomId(targetRoomId);

    if (targetRoomId) {
      const { data: members } = await supabase
        .from("room_members")
        .select("id, user_id, role, profiles:user_id(display_name, department)")
        .eq("room_id", targetRoomId)
        .eq("status", "active");
      if (members) {
        setActiveRoomMembers(
          members as unknown as Array<{
            id: string;
            user_id: string;
            role: string;
            profiles?: { display_name: string; department: string };
          }>,
        );
      }
    }

    // If user is lead, load all applications
    if (user && data.lead_id === user.id) {
      const appsRes = await getApplicationsForRequest(requestId);
      if (appsRes.success && appsRes.data) {
        setLeadApplications(appsRes.data);
      }
    } else if (user) {
      // Check user's own application
      const { data: myApp } = await supabase
        .from("applications")
        .select("*, application_files(*)")
        .eq("request_id", requestId)
        .eq("applicant_id", user.id)
        .maybeSingle();

      if (myApp) {
        setMyApplication(myApp as unknown as Application & { application_files?: ApplicationFile[] });
      } else {
        setMyApplication(null);
      }
    }

    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    fetchRequestDetails();
  }, [fetchRequestDetails]);

  const handleWithdraw = async () => {
    if (!myApplication) return;
    setWithdrawing(true);
    const res = await withdrawApplication(myApplication.id);
    setWithdrawing(false);

    if (res.success) {
      showToast({
        type: "success",
        title: "Application Withdrawn",
        description: "Your application and uploaded files have been deleted.",
      });
      setMyApplication(null);
      fetchRequestDetails();
    } else {
      showToast({
        type: "error",
        title: "Withdrawal Failed",
        description: res.error || "Could not withdraw application.",
      });
    }
  };

  const handleAcceptInvite = async (appId: string) => {
    setActionLoadingId(appId);
    const res = await acceptInviteAction(appId);
    setActionLoadingId(null);

    if (res.success) {
      showToast({
        type: "success",
        title: "Invite Accepted! 🎉",
        description: "You are now an official team member of this project.",
      });
      fetchRequestDetails();
    } else {
      showToast({
        type: "error",
        title: "Could Not Accept Invite",
        description: res.error || "This team has already filled all available spots.",
      });
      fetchRequestDetails();
    }
  };

  const handleDeclineInvite = async (appId: string) => {
    setActionLoadingId(appId);
    const res = await declineInviteAction(appId);
    setActionLoadingId(null);

    if (res.success) {
      showToast({
        type: "info",
        title: "Invite Declined",
        description: "You have declined this project team invitation.",
      });
      fetchRequestDetails();
    } else {
      showToast({
        type: "error",
        title: "Error",
        description: res.error || "Could not decline invite.",
      });
    }
  };

  const handleWaitlist = async (appId: string) => {
    setActionLoadingId(appId);
    const res = await waitlistApplicant(appId);
    setActionLoadingId(null);

    if (res.success) {
      showToast({
        type: "info",
        title: "Applicant Waitlisted",
        description: "Candidate moved to your private waiting list.",
      });
      fetchRequestDetails();
    } else {
      showToast({
        type: "error",
        title: "Waitlist Failed",
        description: res.error || "Could not waitlist candidate.",
      });
    }
  };

  const handleReject = async (appId: string) => {
    setActionLoadingId(appId);
    const res = await rejectApplicant(appId);
    setActionLoadingId(null);

    if (res.success) {
      showToast({
        type: "info",
        title: "Applicant Rejected",
        description: "Candidate marked as rejected.",
      });
      fetchRequestDetails();
    } else {
      showToast({
        type: "error",
        title: "Action Failed",
        description: res.error || "Could not reject candidate.",
      });
    }
  };

  const handleCloseEarly = async () => {
    if (!request) return;
    setIsClosing(true);
    const res = await closeRequestAction(request.id);
    setIsClosing(false);

    if (res.success) {
      showToast({
        type: "success",
        title: "Request Closed Early",
        description: "The team request has been closed and your project room is active!",
      });
      fetchRequestDetails();
    } else {
      showToast({
        type: "error",
        title: "Failed to Close Request",
        description: res.error || "Could not close request.",
      });
    }
  };

  const handleDownloadFile = async (fileId: string) => {
    const res = await getSecureFileDownloadUrl(fileId);
    if (res.success && res.data?.downloadUrl) {
      window.open(res.data.downloadUrl, "_blank");
    } else {
      showToast({
        type: "error",
        title: "Download Failed",
        description: res.error || "Unable to download file.",
      });
    }
  };

  const getDeptName = (code: string) =>
    collegeConfig.departments?.[code.toLowerCase()] || code.toUpperCase();

  const isLead = Boolean(request && currentUserId && request.lead_id === currentUserId);

  // Spot calculation: Invariant 4: Count drops ONLY on acceptance, not on selection!
  const acceptedApplicants = leadApplications.filter((a) => a.status === "accepted");
  const selectedApplicants = leadApplications.filter((a) => a.status === "selected");
  const appliedApplicants = leadApplications.filter((a) => a.status === "applied");
  const waitlistedApplicants = leadApplications.filter((a) => a.status === "waitlisted");
  const allApplicants = leadApplications;

  const remainingSpots = Math.max(0, (request?.headcount || 0) - acceptedApplicants.length);
  const isTeamFull = remainingSpots === 0;

  const currentTabApplicants =
    leadTab === "applied"
      ? appliedApplicants
      : leadTab === "selected"
        ? selectedApplicants
        : leadTab === "waitlisted"
          ? waitlistedApplicants
          : leadTab === "accepted"
            ? acceptedApplicants
            : allApplicants;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6 text-left">
        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/requests" className="hover:text-indigo-600 dark:hover:text-indigo-400">
            &larr; Back to Requests Feed
          </Link>
        </div>

        {loading ? (
          <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse space-y-4">
            <div className="h-6 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-24 w-full bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        ) : error || !request ? (
          <Card className="p-8 text-center space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Request Inaccessible
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">{error}</p>
            <Link href="/requests">
              <Button variant="primary" size="sm">
                Return to Feed
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Main Header Card */}
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={isTeamFull ? "danger" : "accent"}
                      size="md"
                      dot={!isTeamFull}
                    >
                      {isTeamFull
                        ? "TEAM FULL (0 Spots Left)"
                        : `${remainingSpots} of ${request.headcount} Spot${request.headcount > 1 ? "s" : ""} Available`}
                    </Badge>

                    {selectedApplicants.length > 0 && isLead && (
                      <Badge variant="warning" size="sm">
                        {selectedApplicants.length} Pending Invite{selectedApplicants.length > 1 ? "s" : ""}
                      </Badge>
                    )}

                    {request.room_id && (
                      <Badge variant="warning" size="sm">
                        Follow-up Request
                      </Badge>
                    )}

                    {request.resume_required && (
                      <Badge variant="neutral" size="sm">
                        Resume Required
                      </Badge>
                    )}
                  </div>

                  {isLead && isTeamFull && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsRaiseHeadcountOpen(true)}
                      className="bg-indigo-600 text-xs py-1"
                    >
                      + Raise Headcount
                    </Button>
                  )}
                </div>

                <CardTitle className="text-2xl font-bold">{request.title}</CardTitle>
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  Target Specialty: {request.role_needed}
                </p>
              </CardHeader>

              <CardContent className="space-y-6 pt-4">
                {/* Active Room Banner */}
                {activeRoomId && (
                  <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">🚀 Project Team Room is Active!</p>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                        {activeRoomMembers.length} confirmed member{activeRoomMembers.length !== 1 ? "s" : ""} collaborating.
                      </p>
                    </div>
                    <Link href="/rooms">
                      <Button variant="primary" size="sm" className="text-xs">
                        Open Room &rarr;
                      </Button>
                    </Link>
                  </div>
                )}

                {/* Follow-up: Existing Room Members */}
                {request.room_id && activeRoomMembers.length > 0 && (
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Current Team Members in Project Room
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {activeRoomMembers.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium"
                        >
                          <Avatar name={m.profiles?.display_name || "Member"} size="sm" />
                          {m.profiles?.display_name} ({m.profiles?.department})
                          {m.role === "lead" && <Badge variant="accent" size="sm">Lead</Badge>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Project Overview & Deliverables
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                    {request.description}
                  </p>
                </div>

                {/* Skill tags */}
                {request.tags && request.tags.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Required Skills & Technologies
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {request.tags.map((tag) => (
                        <Chip key={tag} label={tag} variant="accent" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Eligibility requirements */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Candidate Eligibility
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-200">Study Level:</p>
                      <p>
                        {request.filter_years && request.filter_years.length > 0
                          ? request.filter_years
                              .map((y) => getStudyLevelLabel(admissionYearToStudyLevel(y)))
                              .join(", ")
                          : "Any Academic Year"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-200">Department:</p>
                      <p>
                        {request.filter_departments && request.filter_departments.length > 0
                          ? request.filter_departments.map(getDeptName).join(", ")
                          : "Any Department"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-200">Gender:</p>
                      <p>
                        {request.filter_genders && request.filter_genders.length > 0
                          ? request.filter_genders
                              .map((g) => g.charAt(0).toUpperCase() + g.slice(1))
                              .join(", ")
                          : "No Restriction"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lead Profile Snippet */}
                {leadProfile && (
                  <div className="flex items-center gap-3 pt-2">
                    <Avatar name={leadProfile.display_name} size="lg" />
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {leadProfile.display_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Project Lead &bull; {getDeptName(leadProfile.department)}{" "}
                        {leadProfile.admission_year
                          ? `(${getStudyLevelLabel(
                              admissionYearToStudyLevel(leadProfile.admission_year),
                            )})`
                          : ""}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>

              {/* Applicant Action Footer (Non-Lead) */}
              {!isLead && (
                <CardFooter className="pt-4">
                  {myApplication ? (
                    <div className="w-full space-y-3">
                      {/* Special Banner if Selected */}
                      {myApplication.status === "selected" && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base">🎉</span>
                              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                                You Have Been Selected!
                              </h4>
                              <CountdownBadge expiresAt={myApplication.expires_at} />
                            </div>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                              Accept the offer to secure your spot. Note that spots are filled on a first-to-accept basis.
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeclineInvite(myApplication.id)}
                              disabled={actionLoadingId === myApplication.id}
                              className="text-xs"
                            >
                              Decline
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleAcceptInvite(myApplication.id)}
                              isLoading={actionLoadingId === myApplication.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                            >
                              Accept Invitation
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Special Banner if Accepted */}
                      {myApplication.status === "accepted" && (
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
                              Official Team Member 🚀
                            </h4>
                            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                              You have accepted this invitation and are part of the team!
                            </p>
                          </div>
                          <Badge variant="accent">CONFIRMED</Badge>
                        </div>
                      )}

                      {/* Standard Application Status Card */}
                      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                myApplication.status === "accepted"
                                  ? "accent"
                                  : myApplication.status === "selected"
                                    ? "warning"
                                    : myApplication.status === "waitlisted"
                                      ? "neutral"
                                      : "neutral"
                              }
                              size="sm"
                              dot
                            >
                              Status: {myApplication.status.toUpperCase()}
                            </Badge>
                          </div>
                          {myApplication.note && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
                              &quot;{myApplication.note}&quot;
                            </p>
                          )}
                          {myApplication.application_files &&
                            myApplication.application_files.length > 0 && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-xs text-slate-500">Attachment:</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDownloadFile(myApplication.application_files![0].id)
                                  }
                                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  Download Resume
                                </button>
                              </div>
                            )}
                        </div>

                        {myApplication.status !== "accepted" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleWithdraw}
                            isLoading={withdrawing}
                            className="text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900"
                          >
                            Withdraw Application
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : request.status === "open" ? (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setIsApplyOpen(true)}
                      className="w-full sm:w-auto"
                    >
                      Apply to Join Project
                    </Button>
                  ) : (
                    <p className="text-xs text-slate-500">This request is no longer accepting new applications.</p>
                  )}
                </CardFooter>
              )}
            </Card>

            {/* Lead Review Section: Shown ONLY to the Request Lead */}
            {isLead && (
              <Card>
                <CardHeader className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle>Lead Candidate Console</CardTitle>
                      <CardDescription>
                        Manage applications, send invites, maintain your private waiting list, and oversee confirmed members.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {request.status !== "closed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCloseEarly}
                          isLoading={isClosing}
                          className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30"
                        >
                          Close Request Early
                        </Button>
                      )}
                      {activeRoomId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsFollowUpOpen(true)}
                          className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/30"
                        >
                          + Follow-up Request
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsRaiseHeadcountOpen(true)}
                        className="text-xs"
                      >
                        Adjust Headcount
                      </Button>
                    </div>
                  </div>

                  {/* Console Tabs */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setLeadTab("applied")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        leadTab === "applied"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      New ({appliedApplicants.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeadTab("selected")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        leadTab === "selected"
                          ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Invites Sent ({selectedApplicants.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeadTab("waitlisted")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        leadTab === "waitlisted"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Waiting List ({waitlistedApplicants.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeadTab("accepted")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        leadTab === "accepted"
                          ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Confirmed Team ({acceptedApplicants.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeadTab("all")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        leadTab === "all"
                          ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      All ({allApplicants.length})
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {currentTabApplicants.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      No candidates in this category.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {currentTabApplicants.map((app) => {
                        const isLoading = actionLoadingId === app.id;

                        return (
                          <div key={app.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-3">
                                <Avatar name={app.profiles?.display_name || "Applicant"} size="md" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-semibold">
                                      {app.profiles?.display_name}
                                    </h4>
                                    {app.status === "selected" && (
                                      <CountdownBadge expiresAt={app.expires_at} />
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    {getDeptName(app.profiles?.department || "")} &bull;{" "}
                                    {app.profiles?.admission_year
                                      ? getStudyLevelLabel(
                                          admissionYearToStudyLevel(app.profiles.admission_year),
                                        )
                                      : "Student"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    app.status === "accepted"
                                      ? "accent"
                                      : app.status === "selected"
                                        ? "warning"
                                        : app.status === "waitlisted"
                                          ? "neutral"
                                          : app.status === "rejected"
                                            ? "danger"
                                            : "neutral"
                                  }
                                  size="sm"
                                >
                                  {app.status.toUpperCase()}
                                </Badge>
                              </div>
                            </div>

                            {app.note && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 pl-11 bg-slate-50/50 dark:bg-slate-800/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                &quot;{app.note}&quot;
                              </p>
                            )}

                            {/* Files */}
                            {app.application_files && app.application_files.length > 0 && (
                              <div className="pl-11 flex items-center gap-2 pt-0.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadFile(app.application_files[0].id)}
                                  className="text-xs py-1 px-2.5 h-auto gap-1"
                                >
                                  <svg
                                    className="h-3.5 w-3.5 text-indigo-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                  </svg>
                                  Download Resume ({(app.application_files[0].file_size_bytes / (1024 * 1024)).toFixed(1)} MB)
                                </Button>
                              </div>
                            )}

                            {/* Lead action bar */}
                            <div className="pl-11 pt-1 flex items-center gap-2 flex-wrap">
                              {app.status === "applied" && (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => setSelectedAppForInvite(app)}
                                    disabled={isLoading}
                                    className="text-xs py-1 px-3 bg-indigo-600 hover:bg-indigo-700"
                                  >
                                    Send Invite
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleWaitlist(app.id)}
                                    disabled={isLoading}
                                    className="text-xs py-1 px-2.5"
                                  >
                                    Add to Waitlist
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReject(app.id)}
                                    disabled={isLoading}
                                    className="text-xs py-1 px-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}

                              {app.status === "waitlisted" && (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => setSelectedAppForInvite(app)}
                                    disabled={isLoading}
                                    className="text-xs py-1 px-3 bg-indigo-600 hover:bg-indigo-700"
                                  >
                                    Promote & Send Invite
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReject(app.id)}
                                    disabled={isLoading}
                                    className="text-xs py-1 px-2.5 text-red-600"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}

                              {app.status === "selected" && (
                                <span className="text-[11px] text-slate-500">
                                  Invitation pending response from candidate.
                                </span>
                              )}

                              {app.status === "accepted" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setMemberToReplace(app)}
                                  disabled={isLoading}
                                  className="text-xs py-1 px-2.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900"
                                >
                                  Replace Member
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Apply Modal */}
            <ApplyModal
              isOpen={isApplyOpen}
              onClose={() => setIsApplyOpen(false)}
              request={request}
              onSuccess={fetchRequestDetails}
            />

            {/* Select & Invite Modal */}
            <SelectApplicantModal
              isOpen={Boolean(selectedAppForInvite)}
              onClose={() => setSelectedAppForInvite(null)}
              application={selectedAppForInvite}
              onSuccess={fetchRequestDetails}
            />

            {/* Raise Headcount Modal */}
            <RaiseHeadcountModal
              isOpen={isRaiseHeadcountOpen}
              onClose={() => setIsRaiseHeadcountOpen(false)}
              requestId={request.id}
              currentHeadcount={request.headcount}
              onSuccess={fetchRequestDetails}
            />

            {/* Replace Member Modal */}
            <ReplaceMemberModal
              isOpen={Boolean(memberToReplace)}
              onClose={() => setMemberToReplace(null)}
              requestId={request.id}
              member={memberToReplace}
              onSuccess={fetchRequestDetails}
            />

            {/* Create Follow-Up Request Modal */}
            {activeRoomId && (
              <CreateFollowUpRequestModal
                isOpen={isFollowUpOpen}
                onClose={() => setIsFollowUpOpen(false)}
                roomId={activeRoomId}
                projectTitle={request.title}
                onSuccess={fetchRequestDetails}
              />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
