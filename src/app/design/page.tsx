"use client";

import React, { useState } from "react";
import {
  Button,
  IconButton,
  Input,
  Textarea,
  Select,
  Checkbox,
  Chip,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Dialog,
  Sheet,
  Tabs,
  Avatar,
  Skeleton,
  EmptyState,
  ProgressBar,
  useToast,
} from "@/components/ui";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

export default function DesignSystemPage() {
  const { showToast } = useToast();

  // Dialog and Sheet states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Form states
  const [inputValue, setInputValue] = useState("");
  const [checkboxValue, setCheckboxValue] = useState(true);
  const [selectedChip, setSelectedChip] = useState("React");
  const progressVal = 65;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Banner */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-base shadow-sm">
              SP
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Design System & Component Showcase
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Student Project Hub UI Toolkit — Prompt 6
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {/* PWA Install Prompt Banner */}
        <section aria-labelledby="pwa-heading">
          <h2 id="pwa-heading" className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
            PWA Install Prompt
          </h2>
          <InstallPrompt />
        </section>

        {/* 1. Buttons */}
        <section aria-labelledby="buttons-heading" className="space-y-4">
          <h2 id="buttons-heading" className="text-xl font-bold tracking-tight">
            Buttons & IconButtons
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Button Variants & States</CardTitle>
              <CardDescription>Primary, secondary, outline, ghost, danger, sizes and loading states</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="primary" isLoading>
                  Loading
                </Button>
                <Button variant="primary" disabled>
                  Disabled
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small (sm)</Button>
                <Button size="md">Medium (md)</Button>
                <Button size="lg">Large (lg)</Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <IconButton aria-label="Favorite" variant="primary">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </IconButton>
                <IconButton aria-label="Settings" variant="secondary">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                </IconButton>
                <IconButton aria-label="Delete" variant="danger">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </IconButton>
                <IconButton aria-label="Loading action" variant="primary" isLoading />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 2. Inputs & Form Controls */}
        <section aria-labelledby="form-heading" className="space-y-4">
          <h2 id="form-heading" className="text-xl font-bold tracking-tight">
            Form Controls
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Inputs, Textarea, Select, & Checkbox</CardTitle>
              <CardDescription>Accessible forms with error messages, helper text, and character counting</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Full Name"
                placeholder="e.g. Aditi Sharma"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                helperText="Enter your name as registered in college records"
              />

              <Input
                label="College Email"
                placeholder="aditi.s.22.cse@rajlakshmi.edu.in"
                error="Must match student pattern: name.initial.year.dept"
              />

              <Select
                label="Department"
                placeholder="Select Department"
                options={[
                  { value: "cse", label: "Computer Science and Engineering" },
                  { value: "it", label: "Information Technology" },
                  { value: "aids", label: "Artificial Intelligence and Data Science" },
                  { value: "ece", label: "Electronics and Communication" },
                ]}
                helperText="Choose your academic department"
              />

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Consent Checkbox
                </p>
                <Checkbox
                  label="I agree to the College Student Project Hub Terms and Privacy Policy"
                  helperText="Your profile and team activity are visible only to verified college members."
                  checked={checkboxValue}
                  onChange={(e) => setCheckboxValue(e.target.checked)}
                />
              </div>

              <div className="md:col-span-2">
                <Textarea
                  label="Project Pitch / Proposal"
                  placeholder="Describe the problem, approach, and target deliverables..."
                  maxLength={500}
                  showCount
                  helperText="Summarize your team's objective in 500 characters or less."
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 3. Chips & Badges */}
        <section aria-labelledby="chips-heading" className="space-y-4">
          <h2 id="chips-heading" className="text-xl font-bold tracking-tight">
            Chips & Badges
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Status Badges & Tag Chips</CardTitle>
              <CardDescription>Visual tags, filter chips, and semantic status indicators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                  Semantic Status Badges
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge variant="neutral">Draft</Badge>
                  <Badge variant="accent" dot>Open (3 spots)</Badge>
                  <Badge variant="success" dot>Accepted</Badge>
                  <Badge variant="warning" dot>Pending Review</Badge>
                  <Badge variant="danger" dot>Closed / Expired</Badge>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                  Interactive Skills Chips
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {["React", "TypeScript", "Python", "Node.js", "Machine Learning"].map((skill) => (
                    <Chip
                      key={skill}
                      label={skill}
                      variant="accent"
                      selected={selectedChip === skill}
                      onClick={() => setSelectedChip(skill)}
                      onRemove={() => console.log("Removed:", skill)}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 4. Feedback & Progress */}
        <section aria-labelledby="feedback-heading" className="space-y-4">
          <h2 id="feedback-heading" className="text-xl font-bold tracking-tight">
            Feedback, Toasts & Progress
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Toast Notifications & Progress Bars</CardTitle>
              <CardDescription>Accessible notifications and progress bars</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    showToast({
                      type: "success",
                      title: "Application Sent!",
                      description: "Your application was submitted to the team lead.",
                    })
                  }
                >
                  Trigger Success Toast
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    showToast({
                      type: "error",
                      title: "Submission Error",
                      description: "File size exceeds the 10 MB limit.",
                    })
                  }
                >
                  Trigger Error Toast
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    showToast({
                      type: "info",
                      title: "@ai Assistant Responded",
                      description: "A project task breakdown has been generated.",
                    })
                  }
                >
                  Trigger Info Toast
                </Button>
              </div>

              <div className="space-y-4 pt-2">
                <ProgressBar
                  value={progressVal}
                  label="Team Milestone Completion"
                  showValue
                  variant="accent"
                />

                <ProgressBar
                  value={90}
                  label="Storage Used"
                  showValue
                  variant="warning"
                />

                <ProgressBar
                  indeterminate
                  label="Syncing Project Feed..."
                  variant="accent"
                />
              </div>

              <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Skeleton Loading Placeholders
                </p>
                <div className="flex items-center gap-3">
                  <Skeleton rounded="full" className="h-10 w-10 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 5. Avatars & Media */}
        <section aria-labelledby="avatars-heading" className="space-y-4">
          <h2 id="avatars-heading" className="text-xl font-bold tracking-tight">
            Avatars
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Avatar Sizes & Statuses</CardTitle>
              <CardDescription>Initials generator with online, offline, and busy status indicators</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Avatar name="Kavitha Raman" size="sm" status="online" />
                <span className="text-xs text-slate-500">Small (sm)</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar name="Rahul Venkatesh" size="md" status="online" />
                <span className="text-xs text-slate-500">Medium (md)</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar name="Dr. Sundar Murthy" size="lg" status="busy" />
                <span className="text-xs text-slate-500">Large (lg)</span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar name="Team Lead" size="xl" status="offline" />
                <span className="text-xs text-slate-500">Extra Large (xl)</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 6. Overlays: Dialog & Sheet */}
        <section aria-labelledby="overlays-heading" className="space-y-4">
          <h2 id="overlays-heading" className="text-xl font-bold tracking-tight">
            Overlays (Dialog & Sheet)
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Modal Dialogs and Slide-Over Drawers</CardTitle>
              <CardDescription>Accessible overlays with backdrop blur, ESC-key closure, and keyboard focus trap</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setIsDialogOpen(true)} variant="primary">
                Open Dialog Modal
              </Button>
              <Button onClick={() => setIsSheetOpen(true)} variant="outline">
                Open Side Sheet Drawer
              </Button>
            </CardContent>
          </Card>

          <Dialog
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            title="Create Project Request"
            description="Broadcast your project idea to find matching college teammates."
          >
            <div className="space-y-4 pt-2">
              <Input label="Project Title" placeholder="AI Smart Campus Navigation" />
              <Select
                label="Target Year Filter"
                options={[
                  { value: "all", label: "Any Year" },
                  { value: "3", label: "3rd Year Students Only" },
                  { value: "4", label: "Final Year Students Only" },
                ]}
              />
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setIsDialogOpen(false)}>
                  Create Request
                </Button>
              </div>
            </div>
          </Dialog>

          <Sheet
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
            title="Room Member List"
            position="right"
          >
            <div className="space-y-3 pt-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active students and faculty mentors in this project room:
              </p>
              {[
                { name: "Aditi S", role: "Team Lead", dept: "CSE 3rd Year" },
                { name: "Rahul V", role: "Frontend Dev", dept: "IT 3rd Year" },
                { name: "Dr. Sundar M", role: "Faculty Mentor", dept: "ECE Faculty" },
              ].map((m) => (
                <div key={m.name} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} size="sm" status="online" />
                    <div>
                      <p className="text-xs font-semibold">{m.name}</p>
                      <p className="text-[11px] text-slate-500">{m.dept}</p>
                    </div>
                  </div>
                  <Badge variant="accent" size="sm">{m.role}</Badge>
                </div>
              ))}
            </div>
          </Sheet>
        </section>

        {/* 7. Tabs */}
        <section aria-labelledby="tabs-heading" className="space-y-4">
          <h2 id="tabs-heading" className="text-xl font-bold tracking-tight">
            Tabs Component
          </h2>
          <Card>
            <CardContent className="pt-6">
              <Tabs
                tabs={[
                  {
                    id: "feed",
                    label: "Requests Feed",
                    badge: <Badge variant="accent">3 New</Badge>,
                    content: (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300">
                        Shows open team requests filtered by department, admission year, and skills.
                      </div>
                    ),
                  },
                  {
                    id: "tasks",
                    label: "Task Board",
                    content: (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300">
                        Displays Kanban milestones and tasks with single-level subtasks.
                      </div>
                    ),
                  },
                  {
                    id: "chat",
                    label: "Realtime Room Chat",
                    content: (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300">
                        Team conversations with reactions, mentions, and files.
                      </div>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
        </section>

        {/* 8. Empty State */}
        <section aria-labelledby="empty-heading" className="space-y-4">
          <h2 id="empty-heading" className="text-xl font-bold tracking-tight">
            Empty State
          </h2>
          <EmptyState
            title="No Project Requests Yet"
            description="Be the first to propose an idea or wait for your batchmates to publish open team requests."
            action={
              <Button variant="primary" size="sm" onClick={() => setIsDialogOpen(true)}>
                Create First Request
              </Button>
            }
          />
        </section>
      </main>
    </div>
  );
}
