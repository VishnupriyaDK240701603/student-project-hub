"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { RequestCard } from "@/components/requests/RequestCard";
import { MyApplicationCard } from "@/components/applications/MyApplicationCard";
import { CreateRequestModal } from "@/components/requests/CreateRequestModal";
import { ApplyModal } from "@/components/applications/ApplyModal";
import { EmptyState, Skeleton, useToast } from "@/components/ui";
import { getTeamRequestsFeed, getMyTeamRequests, closeTeamRequest } from "@/server/actions/requests";
import { getMyApplicationsAction, type MyApplicationItem } from "@/server/actions/applications";
import { createClient } from "@/lib/supabase/client";
import type { TeamRequest } from "@/types/database.types";

export default function RequestsPage() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"feed" | "mine" | "applications">("feed");
  const [feedRequests, setFeedRequests] = useState<TeamRequest[]>([]);
  const [myRequests, setMyRequests] = useState<TeamRequest[]>([]);
  const [myApplications, setMyApplications] = useState<MyApplicationItem[]>([]);
  const [appFilter, setAppFilter] = useState<"all" | "selected" | "accepted" | "applied" | "waitlisted">("all");
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Student");
  const [currentUserDept, setCurrentUserDept] = useState<string>("CSE");
  const [applyingRequest, setApplyingRequest] = useState<TeamRequest | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        supabase
          .from("profiles")
          .select("display_name, department")
          .eq("id", user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.display_name) setCurrentUserName(data.display_name);
            if (data?.department) setCurrentUserDept(data.department);
          });
      }
    });
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const hasFetchedFeedRef = useRef(false);
  const hasLoadedMineRef = useRef(false);
  const hasLoadedApplicationsRef = useRef(false);
  const skipInitialFeedRefetchRef = useRef(true);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load the visible feed first; private tabs are loaded when the user opens them.
  const loadInitialData = useCallback(async () => {
    setInitialLoading(true);
    try {
      const feedRes = await getTeamRequestsFeed({
        search: debouncedSearch,
      });
      if (feedRes.success && feedRes.data) {
        setFeedRequests(feedRes.data.requests);
      }
    } finally {
      setInitialLoading(false);
    }
  }, [debouncedSearch]);

  // Load feed requests on filter change
  const loadFeed = useCallback(async () => {
    const res = await getTeamRequestsFeed({
      search: debouncedSearch,
    });
    if (res.success && res.data) {
      setFeedRequests(res.data.requests);
    }
  }, [debouncedSearch]);

  // Load user's own requests & applications
  const loadMineAndApps = useCallback(async () => {
    const [mineRes, appsRes] = await Promise.all([
      getMyTeamRequests(),
      getMyApplicationsAction(),
    ]);
    if (mineRes.success && mineRes.data) {
      setMyRequests(mineRes.data);
      hasLoadedMineRef.current = true;
    }
    if (appsRes.success && appsRes.data) {
      setMyApplications(appsRes.data);
      hasLoadedApplicationsRef.current = true;
    }
  }, []);

  // Initial load once on mount
  useEffect(() => {
    if (!hasFetchedFeedRef.current) {
      hasFetchedFeedRef.current = true;
      loadInitialData();
    }
  }, [loadInitialData]);

  // Skip the first filter effect because the initial request already includes these filters.
  useEffect(() => {
    if (skipInitialFeedRefetchRef.current) {
      skipInitialFeedRefetchRef.current = false;
      return;
    }
    if (activeTab === "feed") loadFeed();
  }, [activeTab, debouncedSearch, loadFeed]);

  // Load the larger private lists only if the user opens those tabs.
  useEffect(() => {
    if (activeTab === "mine" && !hasLoadedMineRef.current) {
      hasLoadedMineRef.current = true;
      setInitialLoading(true);
      getMyTeamRequests()
        .then((res) => {
          if (res.success && res.data) setMyRequests(res.data);
        })
        .finally(() => setInitialLoading(false));
    }
    if (activeTab === "applications" && !hasLoadedApplicationsRef.current) {
      hasLoadedApplicationsRef.current = true;
      setInitialLoading(true);
      getMyApplicationsAction()
        .then((res) => {
          if (res.success && res.data) setMyApplications(res.data);
        })
        .finally(() => setInitialLoading(false));
    }
  }, [activeTab]);

  const handleCloseRequest = async (id: string) => {
    const res = await closeTeamRequest(id);
    if (res.success) {
      showToast({
        type: "success",
        title: "Request Closed",
        description: "The request has been marked as closed and room formed.",
      });
      loadMineAndApps();
      loadFeed();
    } else {
      showToast({
        type: "error",
        title: "Failed to Close",
        description: res.error || "Could not close request.",
      });
    }
  };

  const handleCreated = (newReq: TeamRequest) => {
    setFeedRequests((prev) => [newReq, ...prev]);
    setMyRequests((prev) => [newReq, ...prev]);
  };

  // Filtered applications list
  const filteredApplications = myApplications.filter((app) => {
    if (appFilter === "all") return true;
    return app.status === appFilter;
  });

  const selectedInvitesCount = myApplications.filter((a) => a.status === "selected").length;
  const acceptedMembersCount = myApplications.filter((a) => a.status === "accepted").length;

  return (
    <AppShell userName={currentUserName} userDepartment={currentUserDept}>
      <div className="space-y-6 text-left">
        {/* Top Header & Search */}
        <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#52715e] dark:text-[#a5c0b0]">Project hub</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#112217] dark:text-[#f4fbf6] sm:text-3xl">
              {activeTab === "applications"
                ? "My Applications & Invites"
                : activeTab === "mine"
                ? "My Created Projects"
                : "Explore Projects"}
            </h1>
          </div>
          {activeTab === "feed" && (
            <label className="relative block w-full sm:max-w-md">
              <span className="sr-only">Search projects, skills, or roles</span>
              <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7a9485]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                }}
                placeholder="Search projects, skills, or roles"
                className="w-full rounded-2xl border border-[#d7e4db] bg-white py-3 pl-12 pr-4 text-sm text-[#112217] shadow-sm placeholder:text-[#82978a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f] dark:border-[#274333] dark:bg-[#0e2016] dark:text-[#f4fbf6] dark:focus-visible:ring-[#74c69d]"
              />
            </label>
          )}
        </div>

        <div className="space-y-6">
          {/* Aesthetic Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#e5eee8] via-[#dceae1] to-[#d2e5d9] dark:from-[#102419] dark:via-[#0c1f15] dark:to-[#091810] border border-[#d1e0d6] dark:border-[#1d3d2a] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_4px_20px_-4px_rgba(10,34,21,0.06)]">
            <div className="space-y-3 z-10 max-w-md text-left">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0a2215] dark:text-[#f4fbf6]">
                Hello, {currentUserName.split(" ")[0]}!
              </h2>
              <p className="text-xs sm:text-sm font-medium text-[#3b5445] dark:text-[#a5c0b0] leading-relaxed">
                {selectedInvitesCount > 0
                  ? `🎉 You have ${selectedInvitesCount} pending team invitation${selectedInvitesCount > 1 ? "s" : ""} waiting for your response!`
                  : "Track all your submitted applications, team invites, and project rooms in one place."}
              </p>
              <div className="pt-2 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-[#0a2215] hover:bg-[#143d28] text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full shadow-md transition-all hover:scale-105 cursor-pointer"
                >
                  <span>Create Request</span>
                  <span>&rarr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === "applications" ? "feed" : "applications")}
                  className={`text-xs font-bold px-4 py-2 rounded-full border transition-all cursor-pointer ${
                    activeTab === "applications"
                      ? "bg-[#0a2215] text-white border-[#0a2215]"
                      : "text-[#143d28] dark:text-[#86efac] border-[#143d28]/20 dark:border-[#86efac]/30 hover:bg-white/40 dark:hover:bg-white/5"
                  }`}
                >
                  {activeTab === "applications" ? "Browse Open Feed" : `View My Applications (${myApplications.length})`}
                </button>
              </div>
            </div>

            {/* Banner Right Image */}
            <div className="relative w-full md:w-56 h-36 md:h-36 rounded-2xl overflow-hidden shadow-md flex-shrink-0 border border-white/60 dark:border-white/10">
              <Image
                src="/images/banner-workspace.svg"
                alt="Student study workspace"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          {/* Main Dashboard Tabs: Feed | My Requests | My Applications */}
          <div className="flex items-center justify-between gap-4 border-b border-[#e3eae5] dark:border-[#1a3525] pb-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab("feed")}
                className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "feed"
                    ? "bg-[#0a2215] text-white shadow-sm"
                    : "text-[#42594b] dark:text-[#a0b8aa] hover:bg-[#f4f7f5] dark:hover:bg-[#14281d]"
                }`}
              >
                <span>Explore Projects</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "feed" ? "bg-white/20 text-white" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                }`}>
                  {feedRequests.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("applications")}
                className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "applications"
                    ? "bg-[#0a2215] text-white shadow-sm"
                    : "text-[#42594b] dark:text-[#a0b8aa] hover:bg-[#f4f7f5] dark:hover:bg-[#14281d]"
                }`}
              >
                <span>My Applications</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedInvitesCount > 0
                    ? "bg-emerald-500 text-white animate-pulse"
                    : activeTab === "applications"
                    ? "bg-white/20 text-white"
                    : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                }`}>
                  {myApplications.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("mine")}
                className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "mine"
                    ? "bg-[#0a2215] text-white shadow-sm"
                    : "text-[#42594b] dark:text-[#a0b8aa] hover:bg-[#f4f7f5] dark:hover:bg-[#14281d]"
                }`}
              >
                <span>My Created Requests</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "mine" ? "bg-white/20 text-white" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                }`}>
                  {myRequests.length}
                </span>
              </button>
            </div>

            {/* Quick action info */}
            {activeTab === "applications" && selectedInvitesCount > 0 && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                {selectedInvitesCount} Action Required
              </span>
            )}
          </div>

          {activeTab === "applications" && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 bg-white dark:bg-[#0e2016] p-3 rounded-2xl border border-[#e3eae5] dark:border-[#1a3525] shadow-xs">
              {(
                [
                  { key: "all", label: "All Statuses", count: myApplications.length },
                  { key: "selected", label: "Invites Received", count: selectedInvitesCount },
                  { key: "accepted", label: "Accepted Teams", count: acceptedMembersCount },
                  { key: "applied", label: "Under Review", count: myApplications.filter((a) => a.status === "applied").length },
                  { key: "waitlisted", label: "Waitlisted", count: myApplications.filter((a) => a.status === "waitlisted").length },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setAppFilter(tab.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    appFilter === tab.key
                      ? "bg-[#0a2215] text-white shadow-sm"
                      : "bg-[#f4f7f5] dark:bg-[#14281d] text-[#42594b] dark:text-[#a0b8aa] hover:bg-[#e8f1ec] dark:hover:bg-[#1a3526]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    appFilter === tab.key ? "bg-white/20 text-white" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Cards Feed Grid / Applications Grid */}
          {initialLoading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="bg-white dark:bg-[#0e2016] p-6 rounded-3xl border border-[#e3eae5] dark:border-[#1a3525] space-y-4 shadow-sm"
                >
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-3/4 rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-2xl" />
                  <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="h-8 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === "applications" ? (
            filteredApplications.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredApplications.map((app) => (
                  <MyApplicationCard
                    key={app.id}
                    application={app}
                    onRefresh={loadMineAndApps}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={
                  appFilter !== "all"
                    ? `No ${appFilter.toUpperCase()} Applications`
                    : "You Haven't Applied to Any Projects Yet"
                }
                description={
                  appFilter !== "all"
                    ? `You currently have no submitted applications in the "${appFilter}" status.`
                    : "Browse open projects on the feed and apply with your skills and resume to collaborate in project rooms."
                }
                action={
                  <button
                    type="button"
                    onClick={() => setActiveTab("feed")}
                    className="bg-[#0a2215] hover:bg-[#143d28] text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-md transition-all cursor-pointer"
                  >
                    Explore Open Projects &rarr;
                  </button>
                }
                className="bg-white dark:bg-[#0e2016] p-12 rounded-3xl border border-[#e3eae5] dark:border-[#1a3525]"
              />
            )
          ) : (activeTab === "feed" ? feedRequests : myRequests).length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {(activeTab === "feed" ? feedRequests : myRequests).map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  isLead={activeTab === "mine"}
                  currentUserId={currentUserId}
                  onClose={handleCloseRequest}
                  onApply={(id) => {
                    const targetReq = (activeTab === "feed" ? feedRequests : myRequests).find((r) => r.id === id);
                    if (targetReq) setApplyingRequest(targetReq);
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={activeTab === "feed" ? "No Matching Projects Found" : "You Have No Open Requests"}
              description={
                activeTab === "feed"
                  ? "There are currently no active team requests matching your filter criteria. Try clearing search or create a new request!"
                  : "Post an open request for your project to attract matching teammates from your college."
              }
              action={
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="bg-[#0a2215] hover:bg-[#143d28] text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-md transition-all cursor-pointer"
                >
                  Create Request
                </button>
              }
              className="bg-white dark:bg-[#0e2016] p-12 rounded-3xl border border-[#e3eae5] dark:border-[#1a3525]"
            />
          )}
        </div>

        {/* Create Request Modal */}
        <CreateRequestModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleCreated}
        />

        {/* Apply Modal */}
        {applyingRequest && (
          <ApplyModal
            isOpen={Boolean(applyingRequest)}
            onClose={() => setApplyingRequest(null)}
            request={applyingRequest}
            onSuccess={() => {
              loadInitialData();
              setActiveTab("applications");
              showToast({
                type: "success",
                title: "Application Submitted! 🎉",
                description: "Your application is now visible under 'My Applications'.",
              });
            }}
          />
        )}
      </div>
    </AppShell>
  );
}

