"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RequestCard } from "@/components/requests/RequestCard";
import { CreateRequestModal } from "@/components/requests/CreateRequestModal";
import { Button, Input, Select, EmptyState, Skeleton, useToast } from "@/components/ui";
import { getTeamRequestsFeed, getMyTeamRequests, closeTeamRequest } from "@/server/actions/requests";
import { collegeConfig } from "../../../college.config";
import type { TeamRequest } from "@/types/database.types";

export default function RequestsPage() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"feed" | "mine">("feed");
  const [feedRequests, setFeedRequests] = useState<TeamRequest[]>([]);
  const [myRequests, setMyRequests] = useState<TeamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load feed requests
  const loadFeed = useCallback(async () => {
    setLoading(true);
    const res = await getTeamRequestsFeed({
      search: searchTerm,
      department: selectedDept !== "all" ? selectedDept : undefined,
    });
    setLoading(false);
    if (res.success && res.data) {
      setFeedRequests(res.data.requests);
    }
  }, [searchTerm, selectedDept]);

  // Load user's own requests
  const loadMine = useCallback(async () => {
    setLoading(true);
    const res = await getMyTeamRequests();
    setLoading(false);
    if (res.success && res.data) {
      setMyRequests(res.data);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "feed") {
      loadFeed();
    } else {
      loadMine();
    }
  }, [activeTab, loadFeed, loadMine]);

  const handleCloseRequest = async (id: string) => {
    const res = await closeTeamRequest(id);
    if (res.success) {
      showToast({
        type: "success",
        title: "Request Closed",
        description: "The request has been marked as closed.",
      });
      loadMine();
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

  const currentList = activeTab === "feed" ? feedRequests : myRequests;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Project Requests
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Discover active projects seeking teammates or broadcast your own idea.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Create Request
          </Button>
        </div>

        {/* Tab & Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start">
            <button
              type="button"
              onClick={() => setActiveTab("feed")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                activeTab === "feed"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              Eligible Feed
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mine")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                activeTab === "mine"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              My Requests
            </button>
          </div>

          {/* Search & Department Filters */}
          <div className="flex items-center gap-3">
            <div className="w-48 sm:w-64">
              <Input
                placeholder="Search titles or skills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                }
              />
            </div>

            <div className="w-40">
              <Select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                options={[
                  { value: "all", label: "All Departments" },
                  ...Object.entries(collegeConfig.departments || {}).map(([code, name]) => ({
                    value: code,
                    label: name,
                  })),
                ]}
              />
            </div>
          </div>
        </div>

        {/* Content Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-12 w-full" />
                <div className="flex gap-2 pt-2">
                  <Skeleton rounded="full" className="h-7 w-7" />
                  <Skeleton className="h-4 w-1/3 my-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : currentList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {currentList.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                isLead={activeTab === "mine"}
                onClose={handleCloseRequest}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={activeTab === "feed" ? "No Eligible Requests Found" : "You Have No Open Requests"}
            description={
              activeTab === "feed"
                ? "There are currently no active team requests matching your year, department, or filters. Check back soon or start your own!"
                : "Post an open request for your project to attract matching teammates from your college."
            }
            action={
              <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
                Create Request
              </Button>
            }
            className="mt-8"
          />
        )}

        {/* Create Request Modal */}
        <CreateRequestModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleCreated}
        />
      </div>
    </AppShell>
  );
}
