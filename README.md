# Student Project Hub

Private team formation, project workspaces, real-time collaboration, and mentor guidance platform for **Rajalakshmi Engineering College** (`@rajalakshmi.edu.in`).

---

## 🚀 Key Features

- **Institutional Domain Auth**: Strictly scoped Google OAuth for `@rajalakshmi.edu.in` with automatic role (student/staff), admission year, and department parsing.
- **Team Requests Feed**: Post project ideas with eligibility filters (department, batch year, gender, resume requirement).
- **Private Project Rooms**: Dedicated team workspace with real-time encrypted messaging and scoped attachment sharing.
- **Kanban Task Board**: Collaborative drag-and-drop task tracking, assignees, due dates, and milestone completion.
- **Scoped `@ai` Assistant**: Context-aware project planner and milestone scheduler powered by Hugging Face Inference API.
- **Faculty Mentor Console**: Invite faculty mentors for project guidance and milestone review.
- **2-Moderator Consensus**: Robust reporting system with immutable snapshot capture and dual-moderator approval for unblocking appeals.
- **Graduation Lifecycle**: Automatic account deactivation on June 30 for graduating batches after 4 years.
- **Enterprise Security**: Row-Level Security (RLS) on all 27 database tables, CSP headers, zero-PII logging, and strict rate limits.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 15 (App Router, Server Actions, TypeScript strict)
- **Styling**: Tailwind CSS & Modern Glassmorphic Design System (Light/Dark themes)
- **Database & Auth**: Supabase PostgreSQL 15 with Row-Level Security (RLS)
- **Testing**: Vitest (294 automated unit & integration tests), Playwright E2E
- **CI/CD**: GitHub Actions (Lint, Typecheck, Unit Tests, Build, Gitleaks, `npm audit`)

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js 20.x or higher
- Supabase Project (`.env.local` configured)

### 2. Installation & Setup
```bash
# Clone the repository
git clone <repo-url>
cd student-project-hub

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
```

### 3. Running Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

```bash
# Run full Vitest test suite (294 tests)
npm test

# Run TypeScript type check
npx tsc --noEmit

# Run ESLint check
npm run lint

# Run production build
npm run build
```

---

## 📚 Documentation

- [Release Checklist](docs/release-checklist.md)
- [Backup & Rollback Procedures](docs/backup-and-rollback.md)
- [Multi-College Replication Guide](docs/new-college-guide.md)
- [User Operating Guides](docs/user-guides.md)
- [Pre-Launch Audit Matrix (F1-F16)](docs/pre-launch-audit.md)
- [Hosting Comparison](docs/hosting-comparison.md)
- [Deployment Guide](docs/deploy.md)
- [Operations Runbook](docs/runbook.md)
