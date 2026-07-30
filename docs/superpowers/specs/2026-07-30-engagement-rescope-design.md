# Engagement-Lens Re-scope — Design

**Date:** 2026-07-30
**Status:** Approved in brainstorming (pending spec review + user sign-off)
**Amends:** `2026-07-25-dev-standards-dashboard-design.md` — the ingest → mine → review → catalog model is unchanged; only the **category taxonomy** and the **mining framing** pivot from *code-quality* to *engagement*.
**Branch:** `feat/phase-1-standards-dashboard`

## 1. Background

The dashboard was originally specified as a **developer code-quality standards catalog**: ingest conversations, mine "software-development standards," and file patterns under code categories (Code Style, Testing, Security, Performance, …).

In practice the conversations being pasted are **Upwork client↔freelancer chats that contain no code**. There is nothing in them for code categories (repo layout, N+1 queries, CI health) to attach to, so 16 of the 17 seeded categories sit permanently empty ("No standards yet"). The one populated standard, **STD-001** ("the freelancer should report when AI-generated tasks fail"), is a *behavioral* observation mis-filed under the code category "Error Handling & Resilience." (STD-001 is a **runtime-approved record already in the DB** — `prisma/seed.ts` creates categories only, zero standards, so it is not a seed row.)

**Pivot:** re-scope from evaluating *code* to evaluating the **engagement** — how the freelancer behaves, communicates, and delivers. This matches the actual data and the stated intent: "paste every software-developer conversation I had on Upwork so AI can surface patterns and unique notable details."

## 2. Goals

- Dashboard taxonomy reflects **engagement dimensions**, not code artifacts.
- Mining prompt extracts **engagement patterns + unique notable details**, not "software-development standards."
- Existing real data (STD-001) is **re-homed**, not lost; empty code categories removed.
- Avoid risky schema migration; minimize the surface area of the change.

## 3. Non-goals (this change)

- Bulk import of many conversations at once (future enhancement).
- PII redaction before mining (offered as optional follow-up; out of scope unless requested).
- Changing conversation ingest/parse, the review/approve flow, the `Job` model, or auth.
- Removing the `appliesTo` schema column (kept dormant; hidden from UI only).

## 4. Design

### 4.1 Category taxonomy (replaces all 17 code categories)

Seed exactly three categories (the engagement dimensions selected by the user):

| slug | name | order | description |
|---|---|---|---|
| `reliability-delivery` | Reliability & Delivery | 1 | Deadlines met/missed, ghosting, overpromising, availability, owning & reporting failures. |
| `scope-requirements` | Scope & Requirements | 2 | Understanding the brief, scope creep, rework, missed or changed requirements. |
| `communication-professionalism` | Communication & Professionalism | 3 | Clarity, responsiveness, tone, proactive updates, conduct. |

**STD-001** ("report when AI-generated tasks fail") re-homes to **Reliability & Delivery** (it is an ownership/reliability behavior). It keeps its content, severity, and `approved` status.

If mining later surfaces a strong cluster of *work-authenticity/AI* signals, a fourth category can be split out — deferred per YAGNI.

### 4.2 Mining prompt rewrite — `src/lib/openai/mining.ts`

The system message is a `content` array of strings joined with spaces (7 elements today). **Replace only the first 3 elements** — the framing:

- `"You analyze a chat conversation between a client and a software freelancer."`
- `"Extract RECURRING or NOTABLE patterns relevant to software-development standards:"`
- `"good practices followed, bad practices or violations, and unique notable details."`

with this new framing (the trailing colon leads into the unchanged element that follows):

> "You analyze a chat conversation between a client and a software freelancer on Upwork. Extract RECURRING patterns and UNIQUE notable details about the freelancer's **engagement** — reliability & delivery, scope & requirements handling, communication & professionalism — plus any notable work-authenticity or conduct signals:"

Keep the remaining elements **verbatim**: the `For each pattern give: …` element, `Never fabricate quotes. Omit any pattern without real evidence.`, and `Do NOT re-propose known patterns. …`. Note: the new framing **supersedes** the old "good practices followed, bad practices or violations" wording — keep only the new version; do not retain both. `response_format` is unchanged.

Category names auto-flow: the worker handler (`src/worker/handlers/mine.ts`) passes `categoryNames: categories.map((c) => c.name)`, so once the 3 engagement categories are seeded, mining receives them automatically — no code change needed beyond the prompt + seed.

### 4.3 Data migration — one-time idempotent script (e.g. `prisma/migrate-to-engagement.ts`, run via `tsx`)

1. Upsert the 3 new categories (by slug) with correct `order`/`description`.
2. **Re-home STD-001** as a **guarded no-op**: match the standard by `code = 'STD-001'`; if it exists, set its `categoryId` to the Reliability & Delivery category id (content/severity/status unchanged); if it does not exist, log and skip. STD-001 is a runtime-approved record (`src/lib/patterns/approve.ts`), **not** seed data, so it may be absent on a fresh DB.
3. **Delete the old code categories** whose `standards` array is empty (guard so a category holding a standard is never dropped). For any old category that still holds a standard, **log a WARNING** naming it and the orphaned standard(s), so a mixed catalog (engagement + leftover code) is visible rather than silently kept. On the current single-user DB, all 17 old categories are empty after step 2 → all deleted.
4. Leave `proposed` patterns untouched (re-categorized at review time).

Logged; running twice yields the same end state.

### 4.4 UI/schema cleanup — `appliesTo` ("Stack")

`appliesTo` (a tech-stack field: React/Node/…) is meaningless for engagement. **Hide it from the UI**, keep the schema column dormant:

- Remove the `appliesTo` row from `src/app/catalog/[code]/page.tsx` (display) and its input from `src/app/catalog/[code]/EditStandardForm.tsx` (edit). Because `EditStandardForm.tsx` currently derives `appliesTo` from the typed input (`f.appliesTo.split(",")…`, defaulting to `["all"]` only when empty), removing the input turns that branch into dead code — **hard-code `appliesTo: ["all"]`** in the request body and drop the now-unreachable coerce logic + the `appliesTo` field from component state, so the API contract stays unchanged.
- No `schema.prisma` change. `src/lib/patterns/approve.ts` already sets `["all"]`.

`severity` (blocker/major/minor) stays — it applies cleanly to engagement.

## 5. Data flow & privacy (FYI, not in scope)

Mining sends each conversation's transcript to **OpenAI** and stores it in **MongoDB**. Upwork chats often contain PII (names, emails, payment figures). Optional follow-up: redact emails/phones/$-amounts before the OpenAI call.

## 6. Testing

- **Migration script:** the seed produces 17 categories and **zero** standards, so the test must **explicitly create STD-001 first** (insert a Standard with `code: 'STD-001'` under an old category), then run the migration and assert: exactly 3 categories remain; STD-001's `categoryId` now points at Reliability & Delivery; content/severity/status unchanged. Also assert idempotency (run twice → same state) and that the re-home is a safe no-op when STD-001 is absent.
- **Mining prompt:** extend **`tests/openai/mining.test.ts`** (not `tests/conversations/parse-ai.test.ts` — that file tests the client/freelancer *role-identification* parser, which never sees the mining prompt or category names). Add an assertion that the **system** prompt contains the engagement framing (e.g. contains "engagement" and "reliability & delivery"), alongside the existing assertions that category names and standard codes flow into the prompt. The 3 new category names reach mining automatically via the worker handler once seeded.
- **UI:** catalog page renders exactly 3 categories; standard detail no longer renders `appliesTo`.
- Verify with `npm run build` (the earlier `prisma generate` build fix must still hold) and `npm test`.

## 7. Build sequence (outline — finalized in the implementation plan)

1. Rewrite `prisma/seed.ts` categories → the 3 engagement categories.
2. Write + test the migration script; run it once against the DB.
3. Rewrite the mining system-prompt line.
4. Hide `appliesTo` in catalog detail + edit form.
5. Update tests referencing code categories; `npm run build` + `npm test`.

## 8. Open items / future

- Bulk conversation import (paste many at once).
- Optional PII redaction pre-mining.
- Split "Work Authenticity & AI Use" into its own category if mining volume warrants.
