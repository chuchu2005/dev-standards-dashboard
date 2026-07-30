# Engagement-Lens Re-scope — Design

**Date:** 2026-07-30
**Status:** Approved in brainstorming (pending spec review + user sign-off)
**Amends:** `2026-07-25-dev-standards-dashboard-design.md` — the ingest → mine → review → catalog model is unchanged; only the **category taxonomy** and the **mining framing** pivot from *code-quality* to *engagement*.
**Branch:** `feat/phase-1-standards-dashboard`

## 1. Background

The dashboard was originally specified as a **developer code-quality standards catalog**: ingest conversations, mine "software-development standards," and file patterns under code categories (Code Style, Testing, Security, Performance, …).

In practice the conversations being pasted are **Upwork client↔freelancer chats that contain no code**. There is nothing in them for code categories (repo layout, N+1 queries, CI health) to attach to, so 16 of the 17 seeded categories sit permanently empty ("No standards yet"). The one populated standard, **STD-001** ("the freelancer should report when AI-generated tasks fail"), is a *behavioral* observation mis-filed under the code category "Error Handling & Resilience."

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

Replace only the system-prompt framing. Before:

> "You analyze a chat conversation between a client and a software freelancer. Extract RECURRING or NOTABLE patterns relevant to software-development standards: good practices followed, bad practices or violations, and unique notable details."

After:

> "You analyze a chat conversation between a client and a software freelancer on Upwork. Extract RECURRING patterns and UNIQUE notable details about the freelancer's **engagement** — reliability & delivery, scope & requirements handling, communication & professionalism — plus any notable work-authenticity or conduct signals. For each, classify good behaviors and problems."

Everything else in the prompt is unchanged: direct-quote evidence (never fabricated), suggested category (from the supplied category names), severity, occurrences, suggested standard text, skip-known-patterns, and the structured `response_format`.

### 4.3 Data migration — one-time idempotent script (e.g. `prisma/migrate-to-engagement.ts`, run via `tsx`)

1. Upsert the 3 new categories (by slug) with correct `order`/`description`.
2. **Re-home STD-001**: set its `categoryId` to the Reliability & Delivery category id (match by `code = 'STD-001'`).
3. **Delete the old code categories** whose `standards` array is empty after step 2 (a guard so a category holding a standard is never dropped). After re-homing, all 17 old categories are empty → safe to delete.
4. Leave `proposed` patterns untouched (re-categorized at review time).

Logged; running twice yields the same end state.

### 4.4 UI/schema cleanup — `appliesTo` ("Stack")

`appliesTo` (a tech-stack field: React/Node/…) is meaningless for engagement. **Hide it from the UI**, keep the schema column dormant:

- Remove the `appliesTo` row from `src/app/catalog/[code]/page.tsx` (display) and its input from `src/app/catalog/[code]/EditStandardForm.tsx` (edit). The form continues to send `appliesTo: ["all"]` so the API contract is unchanged.
- No `schema.prisma` change. `src/lib/patterns/approve.ts` already sets `["all"]`.

`severity` (blocker/major/minor) stays — it applies cleanly to engagement.

## 5. Data flow & privacy (FYI, not in scope)

Mining sends each conversation's transcript to **OpenAI** and stores it in **MongoDB**. Upwork chats often contain PII (names, emails, payment figures). Optional follow-up: redact emails/phones/$-amounts before the OpenAI call.

## 6. Testing

- **Migration script:** test that, given the current seed state (17 categories + STD-001), the script produces exactly the 3 engagement categories with STD-001 under Reliability & Delivery and no data loss; assert idempotency.
- **Mining prompt:** extend the conversations/parse-AI test coverage; assert the system prompt carries the engagement framing and that the supplied category names are the 3 new ones.
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
