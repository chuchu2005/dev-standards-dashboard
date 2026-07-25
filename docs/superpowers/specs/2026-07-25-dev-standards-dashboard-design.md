# Software Development Standards Dashboard — Design Spec

**Date:** 2026-07-25
**Status:** Approved (brainstorming complete) — pending spec review
**Owner:** Founder (single user)

---

## 1. Problem & Goal

A founder hires software developers on Upwork across many engagements. The **quality and consistency of delivered work varies significantly from developer to developer**. There is no shared, enforced definition of "good," so output drifts.

**Goal:** Build a single dashboard that (a) defines an exhaustive, living set of software-development standards, (b) uses AI to discover new standards from real Upwork conversations, and (c) grades delivered work (code and AI tool-output) against those standards, surfacing per-developer consistency over time. The dashboard will be deployed on managed cloud hosting and embedded into an existing Google Sites intranet.

**Success criteria:**
- Every pasted Upwork conversation can be mined for reusable standards patterns.
- Every standard is enforceable — it carries machine-gradeable `howToCheck` instructions, not just prose.
- Every compliance score is traceable to a direct quote from the source work.
- The AI never authors a standard or final score without an explicit human approval.

## 2. Key Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Primary job | All three, integrated: living standards catalog + compliance scoreboard + per-developer scorecards |
| Conversation analysis | **Permanent ingestion feature** (ongoing "paste → AI mines patterns → feeds standards"), not a one-time bootstrap |
| What compliance evaluates | **Pasted/uploaded artifacts** and **work shown inside conversations** — AI/human grading. No Git-repo scanning. |
| Audience | **Single user** (the founder). No multi-user accounts. Minimal auth. |
| Hosting | **Managed cloud** (Koyeb or Railway), embedded into Google Sites via iframe |
| Frontend + API | **Next.js (App Router) + TypeScript** |
| Database | **MongoDB** (managed, e.g. MongoDB Atlas) |
| ORM | **Prisma** |
| LLM | **OpenAI** (structured outputs / json_schema), user-supplied API key |

**Known trade-off accepted by owner:** the data is fundamentally relational (standards ↔ evaluations ↔ developers ↔ scorecards), and MongoDB makes join/aggregation heavy operations (scorecard rollups) less natural than PostgreSQL. This is acceptable at single-user scale; rollups are implemented as multi-query aggregations and results are cached.

## 3. Architecture & Deployment

One Next.js full-stack application (UI + server API in one codebase) backed by MongoDB, with an LLM engine performing mining and grading. A **background worker** handles long-running AI jobs because mining/grading a large conversation can take 30s–2min and cannot complete inside a normal web request.

**Deployment topology** (two processes from one codebase, sharing one MongoDB database):
- `web` service — the dashboard UI and REST/RSC API routes.
- `worker` service — polls a `Job` collection and executes AI mining/grading tasks.

**Why a worker:** long AI jobs would time out in a synchronous web request. The worker + Job-table pattern is what makes the system reliable instead of prone to timeouts.

**Worker operation:** the worker polls the `Job` collection on a short cadence (every ~5s), atomically claims a queued job by setting its status to `running` (preventing double-execution), and runs **one job at a time** per worker instance. The single-user deployment runs one worker process; additional instances can be added later if throughput ever matters.

**Embedding into the intranet:** the deployed app is linked from, or embedded into, the Google Sites intranet via an `<iframe>` embed code. The single-user password gates access so it is not exposed openly.

## 4. Data Model (MongoDB collections)

Nine collections. Embedded (lives inside a parent document) vs referenced (own collection, linked by id) is noted per field.

### 4.1 `Category`
Groups standards into a browsable hierarchy.
- `name`, `slug`, `description`, `parentId` (for sub-categories), `order`

### 4.2 `Standard`
One development standard. The atomic, gradeable unit.
- `code` (e.g. `GIT-001`), `title`, `description`, `categoryId` (referenced), `severity` (blocker | major | minor), `status` (draft | approved | deprecated)
- `howToCheck` — the explicit instructions the AI uses to grade this standard (what makes it enforceable)
- `appliesTo` — `stacks[]` (e.g. `["all"]`, `["typescript","react"]`, `["python"]`); grades only run standards whose `appliesTo` matches the target's detected stack
- `examples` — `{ good: string, bad: string }` (embedded)
- `source` — `authored` | `mined`; `sourceConversationId`; `version`; timestamps

### 4.3 `Conversation`
A pasted Upwork thread.
- `title`, `developerName`, `rawText`, `metadata` (project, dates)
- `parsedMessages` — embedded array of `{ role, author, content, timestamp }`
- `status` — `ingested` | `analyzed` | `graded`

### 4.4 `Pattern`
**The discovery unit.** An AI-extracted insight *before* it becomes a Standard. This collection **is** the approval gate.
- `fromConversationId` (referenced), `description`, `suggestedCategory`, `severity`
- `evidence` — embedded array of direct quotes from the conversation
- `occurrences` (count), `suggestedStandardText`
- `status` — `proposed` → `approved-as-standard` | `rejected` | `merged`
- `linkedStandardId` (set once approved), `reviewedAt`

### 4.5 `Artifact`
A pasted/uploaded code file or AI tool-output submitted for grading.
- `developerId` (referenced), `filename`, `language`, `content`, `type` (`code` | `tool-output` | `snippet`)
- optional `conversationId`

### 4.6 `Evaluation`
**The relational core.** One Standard checked against one target.
- `targetType` (`conversation` | `artifact`), `targetId`, `standardId` (referenced), `developerId` (referenced)
- `result` (`pass` | `fail` | `partial` | `n-a`), `confidence` (0–1)
- `rationale` + `evidence` quotes (embedded)
- `evaluator` (`ai` | `human`), `modelVersion`, `evaluatedAt`

### 4.7 `Developer`
A profile auto-derived from conversations/artifacts.
- `name`, `aliases[]` (name variants — AI suggests merges, human confirms), `notes`, `firstSeen`, `lastSeen`

**Materialization:** Phase 1 creates a bare `Developer` record from each `Conversation.developerName` (one per distinct name). Alias merging and identity resolution are Phase 3 work.

### 4.8 `Scorecard`
Cached per-developer rollup (materialized, not recomputed per view).
- `developerId` (referenced), `period`
- `overallScore`, `perCategory` scores (embedded map), `trend`
- `strengths[]`, `gaps[]`, `computedAt`

**Scoring formula:** the exact rollup (how `pass`/`fail`/`partial`/`n-a` and severity weight into `overallScore` and per-category scores) will be specified in Phase 3 planning; it is not required for Phase 1.

### 4.9 `Job`
Background AI task record.
- `type` (`mine-patterns` | `grade`), `targetType`, `targetId`, `status` (`queued` | `running` | `done` | `failed`), `progress`, `result`/`error`, `tokenCost`, timestamps

### Two core mechanics
- **Discovery:** `Conversation` → AI → `Pattern` (proposed) → **human approves** → `Standard`. Nothing pollutes standards without a click.
- **Compliance:** `Conversation`/`Artifact` → AI → many `Evaluation`s (one per applicable Standard) → rolled up into `Scorecard`.

## 5. Standards Catalog Taxonomy

Seed top-level categories (broad by design so nothing is missed; conversation-mining adds stack-specific standards):

1. Project Structure
2. Code Style & Formatting
3. Language & Framework Idioms
4. Version Control & Commits
5. Code Review
6. Testing
7. Error Handling & Resilience
8. Security
9. Performance
10. Accessibility *(when UI)*
11. Documentation
12. API Design
13. Database & Data
14. **Tool & AI Output Format** — the distinctive category targeting the "tool results must adhere" requirement (structured, citation-backed, no fabricated facts, consistent formatting)
15. Dependencies & Build
16. Deployment & Ops
17. Delivery & Communication — the human side of "quality" (status updates, handoff docs, responsiveness)

**Seed shipping target:** 8–15 drafted standards per category from best practices, then enriched by conversation-mining with standards specific to the owner's actual stacks (JS/TS web frontend, backend/APIs, mobile, data/automation/AI).

**Catalog experience:** collapsible category tree; search/filter by text, category, severity, status; inline editing with per-standard version history; a review queue where proposed `Pattern`s await promotion to `Standard`.

## 6. AI Engine — Two Pipelines

Shared infrastructure: one worker process + the `Job` collection + an OpenAI client using **structured outputs (json_schema)**.

### 6.1 Pipeline A — Discovery (`Conversation → Pattern → Standard`)
1. **Ingest:** paste conversation → stored as `Conversation` → parsed into speaker turns + code blocks.
2. **Queue:** `Job{ type: mine-patterns, targetId }`.
3. **Worker mines:** sends conversation to OpenAI with a structured-output prompt that extracts candidate patterns — each with description, suggested category, severity, **direct-quote evidence**, occurrences, and suggested standard text. The prompt includes existing standard codes so it **does not re-propose known standards**. Re-mining a conversation, or mining one that overlaps prior conversations, is de-duplicated against existing `Pattern`s and `Standard`s (keyword + semantic match); only net-new candidates reach the review queue, and near-duplicates are offered as merge candidates rather than separate entries.
4. **Store** results as `Pattern` (status `proposed`). Not yet a Standard.
5. **Review queue:** human sees each proposed pattern with evidence → Approve (creates `Standard`), Reject, Merge into existing standard, or Edit-then-approve.

### 6.2 Pipeline B — Compliance (`Conversation/Artifact → Evaluations → Scorecard`)
1. **Trigger:** mark conversation analyzed, or submit an Artifact → queue `Job{ type: grade }`.
2. **Worker grades:** loads only **applicable** standards (filtered by the target's detected stack via `Standard.appliesTo`), evaluates the work shown against each — **batched one OpenAI call per category** for accuracy and context safety. Each result → an `Evaluation` (`pass`/`fail`/`partial`/`n-a`, confidence, rationale, evidence quote). The `n-a` option prevents false fails on irrelevant standards. *(Stack detection — how a target's stacks are determined for filtering — is a Phase 2 mechanism and will be specified in Phase 2 planning.)*
3. **Rollup:** recompute the developer's `Scorecard` (overall + per-category, strengths, gaps), cached.

### 6.3 Developer identity resolution
Same person may appear under name variants across conversations. AI **suggests** merges; **human confirms**. Never auto-merged, so scorecards aggregate to the correct person.

### 6.4 Quality controls (anti-hallucination)
- **Approval gates:** AI never writes Standards or final scorecards without a human click.
- **Evidence-first:** every `Pattern`/`Evaluation` must cite a direct quote; missing quote → flagged low-confidence and filterable.
- **Structured outputs** enforce shape; no free-text drift.
- **Confidence routing:** low-confidence `Evaluation`s go to a "needs your eyes" queue, not silently into scores. The threshold is configurable (default `0.7`).
- **Model versioning:** each `Evaluation` records its model so re-grading on upgrade is comparable.

### 6.5 Cost & error handling
- **Cost:** stack-filtered grading, category batching, cached `Evaluation`s (never re-grade unchanged work), per-Job `tokenCost` shown in UI, configurable model tier per job type.
- **Errors:** failed Jobs retry (bounded) then surface with input preserved for one-click retry; long conversations chunked via windowed extraction + dedupe to stay within context; OpenAI outages → Job marked `failed`, no data loss.

## 7. Dashboard UX

Four areas plus a woven review queue. Principle: **no black-box numbers** — every score/pattern/grade links to its evidence.

1. **Overview (home):** KPIs — total standards, standards by category/severity, conversations ingested, patterns awaiting review, evaluations run, token spend this period. Compliance pass-rate with trend. Sortable developer list. Persistent badge for anything awaiting review.
2. **Developer Scorecard:** name + aliases + engagement count; overall score and trend; per-category pass/fail/partial heatmap; auto-derived Strengths and Gaps; drill-down from any cell → underlying `Evaluation`s with evidence quotes → source conversation.
3. **Standards Catalog:** browse/search/edit + the Pattern review queue.
4. **Conversations:** ingested threads with mining/grading status and links to patterns/evaluations produced.

## 8. Testing Strategy

- **Unit:** scorecard rollup math (the MongoDB multi-query aggregation), pattern de-duplication, stack detection.
- **Integration:** AI pipelines tested against **recorded fixtures** — a canned conversation + expected patterns/evaluations — using a **mocked LLM client**. Tests never call real OpenAI and never flake on model drift.
- **E2E:** headline flow — paste conversation → patterns in review queue → approve → standard in catalog → grade → scorecard updates.

## 9. Cross-cutting (Security & Ops)

- **Auth:** single-user password, hashed, httpOnly cookie. No account system. The password is set via a server env var on first boot; reset is done by changing the env var and restarting (no in-app reset flow — single-user).
- **Secrets:** OpenAI key and MongoDB connection string live in **server env only**, never shipped to the browser.
- **Observability:** `Job` status + `tokenCost` visible in-app; basic error logging.

## 10. Delivery Roadmap (Approach 1, sequenced)

- **Phase 1 — Foundation + Discovery:** Next.js scaffold; MongoDB schema + Prisma; single-user auth; seeded catalog; conversation ingestion; mining pipeline + worker; Pattern review queue. *Outcome: owner can paste conversations and build standards immediately.*
- **Phase 2 — Compliance:** grading pipeline; stack-filtered `Evaluation`; low-confidence review queue; compliance scoreboard.
- **Phase 3 — Scorecards & Overview:** developer identity/merge; scorecard rollups; overview dashboard; trends; cost tracking.

## 11. Out of Scope (YAGNI)

- Multi-user accounts / per-developer login (owner is the only user).
- Automatic Git-repo scanning / CI integration.
- Real-time collaboration.
- Mobile-native app (responsive web only).
- Public-facing pages (internal tool behind a password).

## 12. Open Questions for Implementation Plan

- Exact managed-cloud provider (Koyeb vs Railway) and MongoDB provider (Atlas) — resolved at planning time.
- Specific OpenAI model tier per job type — configurable, defaulted at planning time.
