"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

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

  // Initials for avatar
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SU";

  const navigation = [
    {
      name: "Home",
      href: "/requests",
      isActive: pathname === "/" || pathname === "/requests",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
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
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
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
    <div className="min-h-screen bg-[#f4f7f5] dark:bg-[#08150e] text-[#112217] dark:text-[#f4fbf6] flex flex-col md:flex-row">
      {/* Desktop Botanical Dark Sidebar */}
      <aside
        aria-label="Sidebar navigation"
        className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-[#0a2215] text-white z-30 select-none shadow-2xl flex-shrink-0"
      >
        <div className="flex flex-col flex-1 min-h-0 relative overflow-hidden">
          {/* Brand Header */}
          <div className="p-6 pb-4">
            <Link href="/requests" prefetch={true} className="flex items-center gap-3 group">
              {/* Botanical Sprout Logo Icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-emerald-300 backdrop-blur-md group-hover:scale-105 transition-transform duration-200">
                <svg className="w-6 h-6 text-[#74c69d]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              </div>
              <div className="leading-tight text-left">
                <span className="block text-base font-bold text-white tracking-tight">
                  Student Project Hub
                </span>
                <span className="block text-[11px] font-medium text-emerald-300/80 tracking-wide">
                  Learn • Build • Grow
                </span>
              </div>
            </Link>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-xs font-medium text-emerald-100/60">Appearance</span>
              <ThemeToggle className="text-emerald-100 hover:bg-white/10" />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto" aria-label="Main Navigation">
            {navigation.map((item) => {
              const active = item.isActive;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={true}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-2xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a2215] ${
                    active
                      ? "bg-[#1b4332] text-white shadow-inner"
                      : "text-emerald-100/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className={active ? "text-emerald-300" : "text-emerald-200/60"}>
                      {item.icon}
                    </span>
                    <span>{item.name}</span>
                  </div>
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <span
                      className={`flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full text-[11px] font-bold ${
                        active
                          ? "bg-white text-[#0a2215]"
                          : "bg-white/15 text-white"
                      }`}
                    >
                      {item.badgeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Botanical Motivational Watermark Graphics at Bottom */}
          <div className="px-6 py-4 relative pointer-events-none">
            <div className="relative z-10">
              <span className="font-['Caveat',cursive] text-2xl text-emerald-300/80 leading-tight block transform -rotate-3">
                Better<br />
                Projects<br />
                Brighter<br />
                Future
              </span>
            </div>
            {/* Organic Waves/Leaves SVG background */}
            <svg
              className="absolute right-0 bottom-0 w-36 h-36 opacity-20 text-emerald-400"
              viewBox="0 0 200 200"
              fill="currentColor"
            >
              <path d="M42.7,-62.9C53.9,-54.3,60.6,-40.8,66.1,-26.8C71.6,-12.8,75.9,1.7,72.9,15C69.9,28.3,59.6,40.4,47.7,50.1C35.8,59.8,22.3,67,7.6,69.5C-7.1,72,-23,69.8,-37.1,62.2C-51.2,54.6,-63.5,41.6,-69.8,26.4C-76.1,11.2,-76.4,-6.2,-70.7,-21.2C-65,-36.2,-53.3,-48.8,-40,-56.9C-26.7,-65,-13.3,-68.6,0.9,-69.8C15.1,-71,31.5,-71.5,42.7,-62.9Z" transform="translate(100 100)" />
            </svg>
          </div>

          {/* User Profile Snippet in Sidebar Footer */}
          <div className="p-4 border-t border-white/10 bg-[#071a10]/60">
            <div className="flex items-center justify-between">
              <Link
                href="/profile"
                prefetch={true}
                className="flex items-center gap-3 flex-1 min-w-0 group"
              >
                <div className="h-10 w-10 rounded-full bg-[#1b4332] border border-emerald-400/40 flex items-center justify-center font-bold text-sm text-emerald-200">
                  {initials}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                    {userName}
                  </p>
                  <p className="text-[11px] text-emerald-300/70 truncate">
                    {isStaff ? "Faculty Mentor" : userDepartment}
                  </p>
                </div>
              </Link>
              <Link
                href="/profile"
                prefetch={true}
                className="p-1.5 text-emerald-300/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Settings"
                aria-label="Profile Settings"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area (Offset for desktop sidebar) */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 pb-20 md:pb-8">
        {/* Mobile Header (hidden on desktop) */}
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#0a2215] text-white shadow-md">
          <Link href="/requests" prefetch={true} className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-emerald-300 font-bold text-sm">
              <svg className="w-5 h-5 text-[#74c69d]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-white">
              Student Project Hub
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/profile" prefetch={true} aria-label="Open profile">
              <div className="h-8 w-8 rounded-full bg-[#1b4332] border border-emerald-400/40 flex items-center justify-center font-bold text-xs text-emerald-200">
                {initials}
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0a2215]/95 backdrop-blur-lg border-t border-white/10 py-2 px-3 pb-safe shadow-2xl"
      >
        <div className="flex items-center justify-around">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true}
              aria-current={item.isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl text-xs transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                item.isActive
                  ? "text-emerald-300 font-bold"
                  : "text-emerald-100/60 hover:text-white"
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badgeCount && item.badgeCount > 0 ? (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-[#0a2215]">
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
