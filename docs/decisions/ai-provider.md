# Architecture Decision Record: AI Provider & Privacy Policy

## Status
Proposed / Pending Owner Approval (`AI_ENABLED=false` by default)

## Context
The Student Project Hub includes an optional `@ai` assistant to help students in project rooms brainstorm ideas, summarize discussions, and propose initial task breakdowns into the project task board.

To protect student privacy and prevent data misuse, strict boundaries must be maintained:
1. Student data must never be used to train public models.
2. AI calls must be explicitly triggered with `@ai` in room chat.
3. Only the current room's bounded context (last 50 messages, active deliverables) is sent.
4. Resumes, applicant notes, contact info, emails, and cross-room data are strictly excluded.
5. Daily usage is capped at 20 queries per user per day.

## Decision
- **Provider**: Hugging Face Inference API / Serverless Endpoint
- **Model**: `meta-llama/Llama-3.1-8B-Instruct` (or configured via `HF_MODEL`)
- **Data Policy & Retention**: Hugging Face does not retain API inputs/outputs for training on paid/dedicated inference endpoints: https://huggingface.co/privacy
- **Environment Configuration**:
  - `HF_TOKEN`: Hugging Face API token (Server-side secret only)
  - `HF_PROVIDER`: `huggingface`
  - `HF_MODEL`: Model identifier
  - `AI_ENABLED`: Set to `true` only after college approval

## Constraints & Security Controls
1. **Prompt Injection Defense**: All room content is serialized as strictly delimited data blocks (`<room_data>...</room_data>`) with system instructions stating it is untrusted data, not instructions.
2. **Schema-Enforced Plan Confirmation**: AI-suggested task plans are presented as non-executable proposal cards; only team members with `can_edit_tasks` permission can confirm and create tasks.
3. **Audit Privacy**: Audit logs store request metadata (user ID, room ID, status) only; prompt and response text are never recorded in system logs.

## Approval
- **Checked Date**: 2026-10-07
- **Approved by**: [Pending Owner Approval]
- **Approval Signature**: ___________________________
