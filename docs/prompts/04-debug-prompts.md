# Debug prompt templates

Copy a template, fill the parts in [brackets], and paste it into Antigravity (Planning mode). Always paste the REAL error text or a screenshot, never keys or real student data.

---

## 1. Diagnose first (use this for most problems)
```
Something is wrong: [describe what you did, what you expected, what happened instead].
Error text or screenshot: [paste].
Do NOT change any code yet.
1. Reproduce the problem and show me the exact steps and output.
2. State the root cause with evidence (file, line, log, or query result).
3. Propose the smallest possible fix and list the files it touches.
4. Wait for my approval.
After I approve: make the fix, add a regression test that fails without the fix and passes with it, run lint, typecheck, tests and the RLS tests, and paste the real output.
Report back: files changed, tests added, command output, anything not verified, any assumption you made.
```

## 2. The result does not match the spec
```
You built [feature]. The spec (docs/spec.md, section [x], feature [Fx]) says: "[quote the exact sentence]".
What I see instead: [describe].
1. Quote the relevant spec text and list the gap between it and the current behavior.
2. Plan the smallest correction. Do not rewrite or reformat unrelated code.
3. Wait for my approval, then implement, add a test that proves the spec statement, and show the output.
If the spec is unclear, ask me instead of guessing.
```

## 3. The agent says it is done but shows no proof
```
You reported that [task] is done. I need evidence, not claims.
For EACH acceptance criterion of Prompt [number], run the command or test that proves it and paste the real, complete output.
For anything you did not run, say "not verified" and explain why.
Run: npm run lint, npm run typecheck, npm test, npm run test:rls, npm run test:e2e, npm run build, npm run scan:secrets and paste the results.
Do not change code in this step unless a check fails; if it fails, stop and show me the failure first.
```

## 4. Scope creep or unrequested changes
```
You changed files outside the scope of Prompt [number].
1. List every file you changed or created, with a one-line reason for each.
2. Mark which ones were in scope and which were not.
3. Revert everything that was out of scope, show me the diff of the revert, and run the tests.
4. Restate the scope of Prompt [number] in your own words and confirm you will stay inside it.
List any real problems you noticed outside the scope in a separate note; do not fix them.
```

## 5. A permission or privacy leak is suspected (high priority)
```
I suspect a leak: [who could see or do what they should not, and how you noticed].
Treat this as a security incident.
1. Write a failing test in the RLS or end-to-end suite that reproduces it, using the exact roles involved. Show it failing.
2. Find the root cause (policy, function, view, Edge Function, cache, or realtime channel).
3. Propose the fix and wait for my approval.
4. After approval: fix it, show the test passing, run the full RLS suite and the end-to-end suite, and check whether the same flaw exists in similar tables or functions.
5. Add an entry to docs/security-report.md.
Do not log or print any real user content while investigating.
```

## 6. It works on my computer but not on staging
```
Feature [x] works locally but fails on staging.
Do NOT change code yet.
1. Compare local and staging configuration: environment variables (names only, never values), Supabase project settings, auth redirect URLs, storage policies, migrations applied, Edge Function versions, hosting settings.
2. List every difference and rank the likely causes.
3. Show me how to check each cause. Wait for my approval before any change.
```

## 7. The screen works but does not look elegant
```
The [screen] works, but it does not look elegant or consistent. Here is a screenshot: [attach].
What is wrong in my eyes: [spacing, alignment, colors, fonts, mobile layout, dark mode, etc.].
1. List each visual problem you can see and the design token or component that should fix it.
2. Fix them using the existing design tokens and components. Do not invent new colors or fonts.
3. Take new screenshots at 360, 768 and 1280 px in light and dark mode and show them.
4. Confirm accessibility (axe) still has no serious violations.
```

## 8. It is slow
```
[Screen or action] is slow: about [N] seconds on [device/network].
1. Measure first: show the network requests, query timings (use EXPLAIN for database queries) and bundle size. Do not guess.
2. Identify the biggest cause with evidence.
3. Propose the smallest fix. Wait for my approval.
4. After the fix, show the before and after measurements. Do not cache any private data in the service worker.
```

## 9. The agent wants to do something risky
Use this when Antigravity proposes a command or change you do not understand (deleting data, force-pushing, touching production, installing something new).
```
Stop. Before doing that, explain in plain language: what exactly it does, why it is needed, what could go wrong, whether it can be undone, and a safer alternative. Do not run it until I say "approved".
```
