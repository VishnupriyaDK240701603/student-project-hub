"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar, Badge } from "@/components/ui";
import { collegeConfig } from "../../../college.config";

export interface AppShellProps {
  children: React.ReactNode;
  userKind?: "student" | "staff";
  userName?: string;
  userDepartment?: string;
  unreadInboxCount?: number;
  pendingMentorCount?: number;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  userKind = "student",
  userName = "Student User",
  userDepartment = "CSE",
  unreadInboxCount = 0,
  pendingMentorCount = 0,
}) => {
  const pathname = usePathname() || "/";

  const isStaff = userKind === "staff";

  const navigation = [
    {
      name: "Requests",
      href: "/requests",
      isActive: pathname === "/" || pathname.startsWith("/requests"),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
    {
      name: "Rooms",
      href: "/rooms",
      isActive: pathname.startsWith("/rooms"),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      name: "Inbox",
      href: "/inbox",
      isActive: pathname.startsWith("/inbox"),
      badgeCount: unreadInboxCount,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      ),
    },
    ...(isStaff
      ? [
          {
            name: "Mentor Console",
            href: "/staff/mentor-inbox",
            isActive: pathname.startsWith("/staff"),
            badgeCount: pendingMentorCount,
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            ),
          },
        ]
      : []),
    {
      name: "Profile",
      href: "/profile",
      isActive: pathname.startsWith("/profile"),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
      {/* Desktop Sidebar (hidden on phone, visible md and up) */}
      <aside
        aria-label="Sidebar navigation"
        className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30"
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo & College Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-base shadow-sm">
                SP
              </div>
              <div className="leading-tight text-left">
                <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">
                  Project Hub
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                  {collegeConfig.name}
                </span>
              </div>
            </Link>
            <ThemeToggle />
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto" aria-label="Main Navigation">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 ${
                  item.isActive
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      item.isActive
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-slate-400 dark:text-slate-500"
                    }
                  >
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </div>
                {item.badgeCount && item.badgeCount > 0 ? (
                  <Badge variant="accent" size="sm">
                    {item.badgeCount}
                  </Badge>
                ) : null}
              </Link>
            ))}
          </nav>

          {/* User Profile Snippet in Desktop Sidebar */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/profile"
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <Avatar name={userName} size="md" status="online" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {userName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {isStaff ? "Faculty Mentor" : userDepartment}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area (Offset for desktop sidebar) */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Mobile Header (hidden on desktop) */}
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-sm">
              SP
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Student Project Hub
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/profile" aria-label="Open profile">
              <Avatar name={userName} size="sm" />
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Phone: fixed bottom, hidden on md+) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 py-2 px-3 pb-safe shadow-lg"
      >
        <div className="flex items-center justify-around">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs transition-colors relative ${
                item.isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badgeCount && item.badgeCount > 0 ? (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                    {item.badgeCount}
                  </span>
                ) : null}
              </div>
              <span className="mt-1 text-[11px]">{item.name}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
};
