# Start here: how to get the app from these prompts

Read this once, then follow it step by step. The goal is that every prompt produces something you can see working, and that nothing moves forward without proof.

## What is in this package
| File | What it is |
|---|---|
| `01-spec.md` | The confirmed spec. Copy to `docs/spec.md` in your repo. |
| `rules/*.md` (4 files) | Rules Antigravity follows in every session. Copy to `.agents/rules/` in your repo. |
| `02-build-prompts-part-1.md` | Prompts 1 to 11: foundation and the core flow. |
| `03-build-prompts-part-2.md` | Prompts 12 to 24: rooms, chat, tasks, @ai, moderation, launch. |
| `04-debug-prompts.md` | Templates for when something goes wrong. |

## Step 0: Confirm the 8 defaults (5 minutes)
Open `01-spec.md`, section 11. You did not answer these; I proposed defaults (moderators managed on an owner page, no private messages, gender choices, when a room is created, test accounts, task permissions, graduation date). Reply to me "accept all defaults" or tell me which to change. I will update the spec. Do not start building until this is settled.

## Step 1: Create your accounts (one time)
Use your own accounts for the demo. The college takes over later (handover is Prompt 24).
1. **GitHub** (a private repository).
2. **Supabase** (free plan): create TWO projects, `student-hub-dev` and `student-hub-staging`. Production comes later.
3. **Google Cloud**: a project with an OAuth client for Google sign-in (your own project for the demo).
4. **Hugging Face**: an account and an access token.
5. **Resend**: an account and an API key. In the demo it sends only to your own address.
6. Hosting: decided in Prompt 22. Do not create anything yet.
Put every key ONLY in a file called `.env.local` on your computer (copy `.env.example` after Prompt 1). Never paste a key into a chat, a prompt, a screenshot or GitHub.

## Step 2: Prepare the repo and Antigravity
1. Create an empty private repo and open it in Antigravity.
2. Create `docs/` and put `01-spec.md` inside as `docs/spec.md`.
3. Create `.agents/rules/` and copy in the four files from `rules/`. Each is under the 12,000-character limit. (If your Antigravity version still uses the older `.agent/rules/` folder, use that.)
4. In Antigravity's settings: use **Planning mode**, set the terminal to **review before run**, and add a deny list for dangerous commands (deleting folders recursively, force-push, dropping databases, anything aimed at production). Setting names change, so check the current docs.
5. Commit this as the first commit.

## Step 3: Run each prompt with this routine
For every prompt, do these 7 things in order:
1. **Paste** the prompt into Antigravity (Planning mode).
2. **Read the plan** it produces. Check: does it stay inside the prompt's scope? Does it touch anything it should not? Does it mention the security checklist? If not, reply "revise the plan to include X" before approving.
3. For prompts marked **WAIT for approval** (2, 3, 4, 9, 16, 20, 22, 23), the agent must stop after the plan. If it starts coding anyway, stop it and paste debug template 4.
4. **Approve** and let it work.
5. **Demand proof.** The agent must show real command output. If it only says "done", paste debug template 3.
6. **Check it yourself** with the "what you should see" table below, and run `npm run lint && npm run typecheck && npm test && npm run build` once yourself.
7. **Commit**, then move to the next prompt. Never start the next prompt on top of a broken one.

If something is wrong, use the matching template in `04-debug-prompts.md`. Template 1 (diagnose first) is the default.

## What you should see after each prompt
| Prompt | You should be able to do or see |
|---|---|
| 1 | `npm run dev` shows a placeholder page; CI file exists |
| 2 | Two documents you can read; nothing runs yet. Approve or ask for changes |
| 3 | `supabase db reset` works; constraint tests pass |
| 4 | `npm run test:rls` shows many passing "access refused" tests |
| 5 | You can sign in with a college test address; a normal Gmail is rejected |
| 6 | A good-looking app shell, light and dark, installable on your phone; `/design` page |
| 7 | Create a request with filters; a non-matching test user cannot see it |
| 8 | Apply with a file; a zip or fake PDF is rejected |
| 9 | Select an applicant; they accept in the inbox; the count drops only then |
| 10 | Closing a request creates one room; a follow-up request adds people to it |
| 11 | Inbox with badge; an email arrives at YOUR test address only; push works on an installed PWA |
| 12 | Rooms list, permissions, lead swap, removal with a visible reason |
| 13 | Invite a staff member; they accept from their console |
| 14 | Realtime chat, reactions, mentions, files; a removed member is cut off |
| 15 | Task board with subtasks, milestones, meetings, dashboard |
| 16 | @ai answers in the room (only after you approve the provider note); a plan needs confirmation |
| 17 | Report, justification, block, appeal; a moderator cannot open any room |
| 18 | Graduation job, limits, privacy notice and consent |
| 19 | Simulated failures do not break the app |
| 20 | Scanner and end-to-end reports; security report written |
| 21 | Fast, accessible, polished screens with screenshots |
| 22 | Staging site live and passing a smoke test |
| 23 | A production checklist and rehearsed rollback (you run production steps yourself) |
| 24 | Documentation, handover list and a final audit table |

## Demo moments (show the college after these)
- After Prompt 6: the look and feel on a phone.
- After Prompt 11: the full flow from request to invite to inbox.
- After Prompt 15: a room with chat, tasks and the dashboard.
- After Prompt 16: @ai planning tasks (with test data until the provider is approved).

## Before ANY real student data goes in (do not skip)
1. Approve `docs/decisions/ai-provider.md` yourself: confirm the exact Hugging Face provider and model, read its retention and training policy, and record the date. Hugging Face routes requests to third-party providers and each has its own policy, so this check is essential before real data goes through @ai.
2. Have the privacy notice reviewed by someone qualified (India's data protection law, and whether any users are under 18).
3. Get a human security review. These prompts add tests and scanners, but no process guarantees zero vulnerabilities, and you are about to hold 5,000 students' resumes and private conversations.
4. Real antivirus scanning of uploads is NOT in the free setup. Strict validation is, but plan a scanner after approval.
5. Move from the free plan to a paid plan before real use: free projects pause after inactivity and have no uptime promise.
6. Test a backup restore.

## Rules of thumb
- Evidence over claims: if the agent did not show output, it did not happen.
- One prompt at a time. Small commits. Never skip the plan review.
- Keys only in `.env.local` and hosting dashboards.
- If Antigravity wants to do something you do not understand, use debug template 9 before approving.
- Come back to me with the agent's output, errors or screenshots (without keys) and I will diagnose the root cause: ambiguous prompt, missing rule, wrong spec, or agent mistake.
