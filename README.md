# Student Project Hub

Private web application & PWA for team formation, project management rooms, task boards, and AI assistance at Rajalakshmi Engineering College.

## Stack
- **Framework:** Next.js 15 (App Router, TypeScript Strict Mode)
- **Styling:** Tailwind CSS
- **Database & Auth:** Supabase (Postgres + RLS)
- **Testing:** Vitest (unit/integration), Playwright (E2E)
- **CI/CD:** GitHub Actions with ESLint, Prettier, TypeScript typechecking & custom secret scanning.

## Available NPM Scripts
- `npm run dev`: Start local development server
- `npm run build`: Production build
- `npm run lint`: Run ESLint checks
- `npm run typecheck`: Run TypeScript type checking
- `npm run test`: Run unit tests with Vitest
- `npm run test:rls`: Run Supabase RLS test suite (Prompt 4+)
- `npm run test:e2e`: Run E2E tests with Playwright
- `npm run audit`: Run npm dependency vulnerability audit
- `npm run scan:secrets`: Run repository secret scanner
