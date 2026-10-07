import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { CURRENT_CONSENT_VERSION } from "@/config/consent";

export const metadata = {
  title: "Privacy Notice & Data Protection Policy | Student Project Hub",
  description: "Institutional privacy guidelines, data retention policies, and DPDP compliance information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-neutral-800 pb-6 space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Institutional Privacy Notice</h1>
            <Badge variant="accent">Version {CURRENT_CONSENT_VERSION}</Badge>
          </div>
          <p className="text-sm text-neutral-400">
            Student Project Hub is committed to protecting student and faculty data in accordance with institutional
            standards and the Digital Personal Data Protection (DPDP) Act.
          </p>
        </div>

        {/* Section 1: Who Sees What */}
        <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-neutral-100 flex items-center gap-2">
            <span>1. Scoped Visibility: Who Sees What</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-neutral-300">
            <div className="rounded-xl bg-neutral-950 p-4 border border-neutral-800 space-y-2">
              <h3 className="font-semibold text-accent-400 text-sm">Room Members</h3>
              <p>
                Have access only to their own room workspace: realtime chat, Kanban task board, milestones, meetings,
                and shared attachments. Non-members cannot query or subscribe to room channels.
              </p>
            </div>
            <div className="rounded-xl bg-neutral-950 p-4 border border-neutral-800 space-y-2">
              <h3 className="font-semibold text-accent-400 text-sm">Faculty Mentors</h3>
              <p>
                Can view progress dashboards, participate in room chat, and assist teams only upon accepting an explicit
                invitation from the team lead. Mentors cannot become lead or browse unjoined rooms.
              </p>
            </div>
            <div className="rounded-xl bg-neutral-950 p-4 border border-neutral-800 space-y-2">
              <h3 className="font-semibold text-accent-400 text-sm">Staff Moderators</h3>
              <p>
                Enforce community guidelines through isolated, confidential report snapshots. Moderators have zero
                database access to query or inspect private room messages directly.
              </p>
            </div>
            <div className="rounded-xl bg-neutral-950 p-4 border border-neutral-800 space-y-2">
              <h3 className="font-semibold text-accent-400 text-sm">System Owner</h3>
              <p>
                Manages staff moderator designations and inspects the immutable audit log. The owner has no permission
                to browse or read private student workspaces.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: 30-Day Retention for Unselected Applicants */}
        <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-neutral-100">2. Applicant Resume & Data Retention</h2>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Resumes, portfolios, and application notes submitted by prospective teammates are kept confidential to the
            project lead. To prevent unnecessary data hoarding, applicant records for unselected candidates are
            automatically purged from active storage 30 days after a request is closed or filled.
          </p>
        </div>

        {/* Section 3: AI Assistant & Third-Party Processing */}
        <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-neutral-100">3. AI Assistant (@ai) & Third-Party Processing</h2>
          <p className="text-sm text-neutral-300 leading-relaxed">
            When a team invokes the <code className="text-accent-400">@ai</code> assistant in a room:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-neutral-300 pl-2">
            <li>Only bounded context from that specific room (recent 50 messages, task titles, deadlines) is processed.</li>
            <li>All personal identifiers (emails, phone numbers, resumes, cross-room data) are strictly stripped.</li>
            <li>Context is passed as inert data blocks with prompt-injection defenses to Hugging Face server endpoints.</li>
            <li>No room messages or file contents are permanently stored in system logs or training sets.</li>
          </ul>
        </div>

        {/* Section 4: Account Lifecycle & Graduation Deactivation */}
        <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-neutral-100">4. Account Lifecycle & Graduation</h2>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Student accounts are tied to academic batches. On 30 June following completion of the prescribed curriculum
            (joining year + 4 years), student login access is automatically deactivated. Project artifacts and historical
            attributions remain preserved within institutional archives.
          </p>
        </div>

        {/* Section 5: DPDP Act Compliance & User Rights */}
        <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6 space-y-3">
          <h2 className="text-xl font-semibold text-neutral-100">5. Your Rights Under DPDP Act 2023</h2>
          <div className="space-y-2 text-sm text-neutral-300">
            <p>Under the Digital Personal Data Protection Act, students and staff have the right to:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Access and review personal profile details and project memberships.</li>
              <li>Request correction of inaccurate departmental or admission data.</li>
              <li>File moderation reports and appeals regarding abusive behavior or policy violations.</li>
              <li>Withdraw consent by requesting institutional account deactivation.</li>
            </ul>
          </div>
        </div>

        {/* Back Link */}
        <div className="pt-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-accent-400 hover:text-accent-300 transition underline underline-offset-4"
          >
            ← Return to Student Project Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
