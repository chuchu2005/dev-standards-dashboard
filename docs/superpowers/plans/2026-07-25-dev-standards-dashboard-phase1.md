# Software Development Standards Dashboard — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a running Next.js app with a seeded standards catalog, conversation ingestion, and the AI mining → Pattern review → Standard approval loop (Phase 1 of the spec).

**Architecture:** One Next.js (App Router) codebase producing two processes — a `web` service (UI + API) and a `worker` process that polls a `Job` collection to run long OpenAI tasks. Both share one MongoDB database via Prisma. The AI mines patterns from pasted Upwork conversations; a human approves patterns before they become standards.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Prisma 5 (MongoDB connector) · MongoDB (Atlas / `mongodb-memory-server` for tests) · OpenAI SDK v4 (structured outputs) · zod · bcryptjs · jose · vitest · tsx

**Spec:** `docs/superpowers/specs/2026-07-25-dev-standards-dashboard-design.md`

---

## Scope

Phase 1 only. Delivers: project scaffold, MongoDB schema (Phase-1 collections), single-user auth, seeded standards catalog (browse/edit), conversation ingestion + parsing, worker + mining pipeline, and the Pattern review queue with approval→Standard. **Out of Phase 1:** compliance grading, stack detection, scorecards, developer identity merge, Artifact/Evaluation/Scorecard collections (Phase 2/3).

## Chunk Map

- **Chunk 1 — Foundation, data layer, read-only catalog** *(this chunk)*
- Chunk 2 — Single-user auth + route protection
- Chunk 3 — Conversation ingestion + parsing + UI
- Chunk 4 — Worker + Job table + OpenAI mining pipeline + dedupe
- Chunk 5 — Pattern review queue + approval→Standard + Phase 1 E2E

## File Structure (Phase 1)

| File | Responsibility |
|---|---|
| `package.json` | Dependencies + scripts (dev/build/seed/worker/test/db:push) |
| `tsconfig.json` | TS config with `@/*` path alias |
| `next.config.ts` | Next config |
| `.env.example` | Documented env vars (DB url, OpenAI key, password hash, session secret) |
| `prisma/schema.prisma` | Prisma models for all Phase-1 collections |
| `prisma/seed.ts` | Seed 17 categories + exemplar standards |
| `src/lib/env.ts` | zod-validated env access |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/types.ts` | zod enums (severity/status/job-type) — Prisma Mongo has no native enums |
| `src/lib/auth/password.ts` | bcrypt hash/compare |
| `src/lib/auth/session.ts` | signed JWT cookie get/set (jose) |
| `src/middleware.ts` | protect all routes except `/login` |
| `src/app/layout.tsx` | root layout + global CSS |
| `src/app/globals.css` | minimal styles |
| `src/app/page.tsx` | home → redirect to `/catalog` |
| `src/app/login/page.tsx` | login form |
| `src/app/login/actions.ts` | login server action |
| `src/app/catalog/page.tsx` | browse standards grouped by category |
| `src/app/catalog/[code]/page.tsx` | standard detail + inline edit |
| `src/app/conversations/page.tsx` | list + ingest form |
| `src/app/conversations/[id]/page.tsx` | conversation detail + mining status |
| `src/lib/conversations/parse.ts` | parse raw text into `ParsedMessage[]` |
| `src/lib/openai/client.ts` | OpenAI client singleton |
| `src/lib/openai/schemas.ts` | zod schemas for structured mining output |
| `src/lib/openai/mining.ts` | build prompt + call OpenAI → proposed patterns |
| `src/lib/patterns/dedupe.ts` | dedupe proposed patterns vs existing patterns/standards |
| `src/lib/patterns/approve.ts` | promote Pattern → Standard |
| `src/worker/index.ts` | poll loop |
| `src/worker/claim.ts` | atomic job claim (compare-and-swap) |
| `src/worker/handlers/mine.ts` | run a mining job end-to-end |
| `src/app/review/page.tsx` | Pattern review queue (approve/reject/merge) |
| `src/app/api/conversations/route.ts` | POST ingest, GET list |
| `src/app/api/conversations/[id]/mine/route.ts` | POST → enqueue mining job |
| `src/app/api/patterns/[id]/route.ts` | PATCH approve/reject/merge |
| `tests/globalSetup.ts` | start `mongodb-memory-server`, push schema |
| `tests/*.test.ts` | unit + integration tests |

---

## Chunk 1: Foundation, data layer, read-only catalog

**Outcome of this chunk:** `npm run dev` shows a browsable catalog of seeded standards grouped by category; `npm test` passes for env validation and seed integrity.

### Prisma + MongoDB gotchas (read before coding)

1. **No native enums.** Prisma's MongoDB connector does not support `enum`. Use `String` fields and enforce allowed values with zod in `src/lib/types.ts` and at all write boundaries.
2. **`prisma db push`, not `migrate`.** MongoDB has no migration engine; schema changes are applied with `npx prisma db push`.
3. **IDs and relation fields need `@db.ObjectId`.** Every `@id` and every foreign-key field must be annotated `@db.ObjectId`, and the PK must be `@map("_id")`.
4. **Embedded sub-documents use `type X { ... }`.** Use these for `examples`, `parsedMessages`, and `evidence`.
5. **MongoDB requires a replica set.** Atlas provides one. For local dev without Atlas, run Mongo as a replica set (e.g. `docker run -e MONGO_INITDB_DATABASE=app mongo --replSet rs0` then `rs.initiate()`). Tests use `mongodb-memory-server`, which runs a replica set automatically.

### Task 1.1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `.gitignore` *(already exists — extend)*

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "dev-standards-dashboard",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "seed": "tsx prisma/seed.ts",
    "worker": "tsx src/worker/index.ts",
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "bcryptjs": "^2.4.3",
    "jose": "^5.9.6",
    "next": "^15.0.3",
    "openai": "^4.73.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "mongodb-memory-server": "^10.1.3",
    "prisma": "^5.22.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.ts`**

```ts
import type { NextConfig } from "next";
const config: NextConfig = {};
export default config;
```

- [ ] **Step 4: Create `.env.example`**

```bash
# MongoDB connection string (replica set required). Atlas works as-is.
DATABASE_URL="mongodb+srv://USER:PASS@cluster.example/dev-standards?retryWrites=true&w=majority"

# OpenAI
OPENAI_API_KEY="sk-..."

# Single-user auth. Generate a bcrypt hash for your password:
#   npx tsx -e "import('bcryptjs').then(b=>console.log(b.default.hashSync('YOUR PASSWORD',10)))"
AUTH_PASSWORD_HASH="$2a$10$..."

# Random 32+ char string for signing session cookies:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
SESSION_SECRET="..."

# OpenAI model used for mining (Phase 1)
OPENAI_MINING_MODEL="gpt-4o-mini"
```

- [ ] **Step 5: Create `vitest.config.ts` (alias only — globalSetup is added in Task 1.6)**

Vite/Vitest do not read `tsconfig.json` paths, so the `@/*` alias must be wired here or test imports like `@/lib/env` will not resolve.

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node" },
});
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: dependencies installed, `node_modules/` created (gitignored).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts .env.example
git commit -m "chore: scaffold next.js project with deps and config"
```

### Task 1.2: Env validation

**Files:**
- Create: `src/lib/env.ts`
- Test: `tests/env.test.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Write the failing test**

```ts
// tests/env.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("env", () => {
  const original = { ...process.env };

  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env = { ...original }; });

  it("parses a valid environment", async () => {
    Object.assign(process.env, {
      DATABASE_URL: "mongodb://localhost:27017/test",
      OPENAI_API_KEY: "sk-test",
      AUTH_PASSWORD_HASH: "$2a$10$hash",
      SESSION_SECRET: "x".repeat(32),
    });
    const { env } = await import("@/lib/env");
    expect(env.DATABASE_URL).toBe("mongodb://localhost:27017/test");
    expect(env.OPENAI_MINING_MODEL).toBe("gpt-4o-mini"); // default applied
  });

  it("rejects a missing DATABASE_URL", async () => {
    Object.assign(process.env, {
      OPENAI_API_KEY: "sk-test",
      AUTH_PASSWORD_HASH: "$2a$10$hash",
      SESSION_SECRET: "x".repeat(32),
    });
    delete process.env.DATABASE_URL;
    await expect(import("@/lib/env")).rejects.toThrow();
  });

  it("rejects a too-short session secret", async () => {
    Object.assign(process.env, {
      DATABASE_URL: "mongodb://localhost:27017/test",
      OPENAI_API_KEY: "sk-test",
      AUTH_PASSWORD_HASH: "$2a$10$hash",
      SESSION_SECRET: "short",
    });
    await expect(import("@/lib/env")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/env.test.ts`
Expected: FAIL — module `@/lib/env` not found.

- [ ] **Step 3: Implement `src/lib/env.ts`**

```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  AUTH_PASSWORD_HASH: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  OPENAI_MINING_MODEL: z.string().default("gpt-4o-mini"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;
export const env = schema.parse(process.env);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts tests/env.test.ts
git commit -m "feat(env): add zod-validated environment config"
```

### Task 1.3: Shared zod enums (no Prisma enums on Mongo)

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Implement `src/lib/types.ts`**

```ts
import { z } from "zod";

// Prisma's MongoDB connector has no enum support — validate with zod at write boundaries.
export const Severity = z.enum(["blocker", "major", "minor"]);
export const StandardStatus = z.enum(["draft", "approved", "deprecated"]);
export const PatternStatus = z.enum(["proposed", "approved-as-standard", "rejected", "merged"]);
export const JobType = z.enum(["mine-patterns", "grade"]);
export const JobStatus = z.enum(["queued", "running", "done", "failed"]);
export const ConversationStatus = z.enum(["ingested", "analyzed", "graded"]);
export const Stack = z.enum([
  "all", "typescript", "javascript", "react", "nextjs", "react-native",
  "node", "python", "go", "flutter", "swift", "kotlin",
]);

export type Severity = z.infer<typeof Severity>;
export type StandardStatus = z.infer<typeof StandardStatus>;
export type PatternStatus = z.infer<typeof PatternStatus>;
export type JobType = z.infer<typeof JobType>;
export type JobStatus = z.infer<typeof JobStatus>;
export type ConversationStatus = z.infer<typeof ConversationStatus>;
export type Stack = z.infer<typeof Stack>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add shared zod enums for mongo string fields"
```

### Task 1.4: Prisma schema (Phase-1 collections)

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

// Embedded sub-documents
type StandardExamples {
  good String?
  bad  String?
}

type ParsedMessage {
  role      String
  author    String
  content   String
  timestamp String?
}

type PatternEvidence {
  quote String
}

model Category {
  id          String     @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  slug        String     @unique
  description String?
  parentId    String?    @db.ObjectId
  order       Int        @default(0)
  standards   Standard[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

model Standard {
  id                   String           @id @default(auto()) @map("_id") @db.ObjectId
  code                 String           @unique
  title                String
  description          String
  categoryId           String?          @db.ObjectId
  category             Category?        @relation(fields: [categoryId], references: [id])
  severity             String           @default("major") // Severity
  status               String           @default("draft") // StandardStatus
  howToCheck           String
  appliesTo            String[]         @default(["all"]) // Stack[]
  examples             StandardExamples?
  source               String           @default("authored") // authored | mined
  sourceConversationId String?          @db.ObjectId // relation deferred — Phase 1 has no join need
  version              Int              @default(1)
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt

  @@index([categoryId])
  @@index([status])
}

model Developer {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  aliases   String[]
  notes     String?
  firstSeen DateTime @default(now())
  lastSeen  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Conversation {
  id              String         @id @default(auto()) @map("_id") @db.ObjectId
  title           String
  developerName   String?
  developerId     String?        @db.ObjectId
  developer       Developer?     @relation(fields: [developerId], references: [id])
  rawText         String
  parsedMessages  ParsedMessage[]
  metadata        Json?
  status          String         @default("ingested") // ConversationStatus
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([developerId])
}

model Pattern {
  id                    String           @id @default(auto()) @map("_id") @db.ObjectId
  fromConversationId    String           @db.ObjectId // relation deferred — Phase 1 has no join need
  description           String
  suggestedCategory     String?
  severity              String           @default("major") // Severity
  evidence              PatternEvidence[]
  occurrences           Int              @default(1)
  suggestedStandardText String?
  status                String           @default("proposed") // PatternStatus
  linkedStandardId      String?          @db.ObjectId
  reviewedAt            DateTime?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  @@index([fromConversationId])
  @@index([status])
}

model Job {
  id         String    @id @default(auto()) @map("_id") @db.ObjectId
  type       String    // JobType
  targetType String?   // conversation | artifact
  targetId   String?   @db.ObjectId
  status     String    @default("queued") // JobStatus
  progress   Int       @default(0)
  result     Json?
  error      String?
  tokenCost  Int       @default(0)
  startedAt  DateTime?
  finishedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([status])
}
```

- [ ] **Step 2: Create `src/lib/db.ts` (Prisma singleton)**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 3: Generate client + push schema**

Run: `npx prisma generate && npx prisma db push`
Expected: `Prisma Client generated`; schema applied to MongoDB. *(Requires a reachable `DATABASE_URL` replica set — see gotcha #5: Atlas works as-is; local Mongo needs `--replSet` + `rs.initiate()`; tests use mongodb-memory-server.)*

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/lib/db.ts
git commit -m "feat(db): add prisma schema for phase-1 collections + client singleton"
```

### Task 1.5: Seed categories + exemplar standards

**Files:**
- Create: `prisma/seed.ts`
- Test: `tests/seed.test.ts` *(uses mongo-memory-server globalSetup from Task 1.6)*

- [ ] **Step 1: Create `prisma/seed.ts`**

The 17 categories are seeded in full. Standards are seeded as **exemplars** (a starter subset) following the exact shape; the full 8–15/category set is grown either by hand or — by design — discovered by the mining pipeline from real conversations. Each exemplar demonstrates the structure: `code`, `description`, `howToCheck`, `appliesTo`, examples.

```ts
// prisma/seed.ts
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Cat = { slug: string; name: string; description: string; order: number };
type Std = {
  code: string; title: string; slug: string; severity: string; appliesTo: string[];
  description: string; howToCheck: string; good?: string; bad?: string;
};

const categories: Cat[] = [
  { slug: "project-structure", name: "Project Structure", order: 1, description: "Repo layout, module boundaries, file/folder naming, separation of concerns." },
  { slug: "code-style", name: "Code Style & Formatting", order: 2, description: "Linting, formatting, naming conventions, line length." },
  { slug: "language-idioms", name: "Language & Framework Idioms", order: 3, description: "Idiomatic code; anti-patterns, per stack." },
  { slug: "version-control", name: "Version Control & Commits", order: 4, description: "Commit messages, branching, PR size, atomic commits." },
  { slug: "code-review", name: "Code Review", order: 5, description: "Review process, approval gates, what reviewers check." },
  { slug: "testing", name: "Testing", order: 6, description: "Unit/integration/e2e, coverage thresholds, test independence." },
  { slug: "error-handling", name: "Error Handling & Resilience", order: 7, description: "Error patterns, logging, graceful degradation, retries." },
  { slug: "security", name: "Security", order: 8, description: "Input validation, secrets, authn/authz, deps, OWASP basics." },
  { slug: "performance", name: "Performance", order: 9, description: "N+1 queries, caching, asset size, complexity." },
  { slug: "accessibility", name: "Accessibility", order: 10, description: "Semantic HTML, ARIA, keyboard, contrast (when UI)." },
  { slug: "documentation", name: "Documentation", order: 11, description: "Comments, README, API docs, decision records." },
  { slug: "api-design", name: "API Design", order: 12, description: "REST/RPC conventions, versioning, status codes, error shape." },
  { slug: "database-data", name: "Database & Data", order: 13, description: "Schema/migrations, indexing, query safety, transactions." },
  { slug: "tool-ai-output", name: "Tool & AI Output Format", order: 14, description: "Structured, citation-backed, no fabricated facts, consistent formatting." },
  { slug: "dependencies-build", name: "Dependencies & Build", order: 15, description: "Lockfiles, reproducible builds, env config." },
  { slug: "deployment-ops", name: "Deployment & Ops", order: 16, description: "Health checks, logging, monitoring, configs." },
  { slug: "delivery-communication", name: "Delivery & Communication", order: 17, description: "Status updates, handoff docs, responsiveness." },
];

const standards: Std[] = [
  {
    code: "VC-001", title: "Atomic commits", slug: "version-control", severity: "major", appliesTo: ["all"],
    description: "Each commit is a single logical change that builds and passes tests on its own.",
    howToCheck: "Inspect commit diffs: a commit must not mix unrelated concerns (e.g. feature + reformat). Running the test suite at the commit must pass.",
    good: "fix: null-check user before profile render",
    bad: "feat: add profile page + reformat whole file + bump deps",
  },
  {
    code: "VC-002", title: "Conventional commit messages", slug: "version-control", severity: "minor", appliesTo: ["all"],
    description: "Commit subjects follow Conventional Commits (type(scope): imperative summary, <=72 chars).",
    howToCheck: "Subject matches ^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\\(.+\\))?!?: .{1,72}$ and is imperative mood.",
  },
  {
    code: "TEST-001", title: "Tests are independent", slug: "testing", severity: "major", appliesTo: ["all"],
    description: "No test depends on another test's side effects or execution order.",
    howToCheck: "Run the suite in random order; all tests still pass. No shared mutable state without explicit setup/teardown.",
  },
  {
    code: "ERR-001", title: "No swallowed errors", slug: "error-handling", severity: "blocker", appliesTo: ["all"],
    description: "Caught errors are logged, rethrown, or handled — never silently discarded.",
    howToCheck: "Search for empty catch blocks (catch { } or catch (e) {}); none exist without a comment explaining why.",
  },
  {
    code: "SEC-001", title: "No secrets in code", slug: "security", severity: "blocker", appliesTo: ["all"],
    description: "API keys, tokens, and passwords come from env/config, never literals in source.",
    howToCheck: "Scan for high-entropy strings and known key prefixes (sk-, AKIA, -----BEGIN) in tracked source; only fixtures/examples allowed.",
  },
  {
    code: "TOOL-001", title: "AI output cites its sources", slug: "tool-ai-output", severity: "major", appliesTo: ["all"],
    description: "Any factual claim or generated code references where it came from; fabricated facts are prohibited.",
    howToCheck: "For each non-trivial claim/snippet in AI output, there is a verifiable source (file/line, doc link, or stated assumption). Claims with no source are flagged.",
  },
];

async function main() {
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name, description: c.description, order: c.order },
    });
  }
  for (const s of standards) {
    const category = await prisma.category.findUnique({ where: { slug: s.slug } });
    if (!category) throw new Error(`Missing category ${s.slug} for standard ${s.code}`);
    await prisma.standard.upsert({
      where: { code: s.code },
      create: {
        code: s.code, title: s.title, description: s.description, howToCheck: s.howToCheck,
        severity: s.severity, appliesTo: s.appliesTo, status: "approved",
        categoryId: category.id, source: "authored",
        examples: s.good || s.bad ? { good: s.good ?? null, bad: s.bad ?? null } : undefined,
      },
      update: {}, // intentional no-op on re-seed: standards are edited in-app; only categories refresh
    });
  }
  console.log(`Seeded ${categories.length} categories and ${standards.length} exemplar standards.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

- [ ] **Step 2: Write the seed integration test**

```ts
// tests/seed.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";

describe("seed", () => {
  it("has all 17 categories", async () => {
    const count = await prisma.category.count();
    expect(count).toBe(17);
  });

  it("seeds exactly 6 exemplar standards, each referencing an existing category", async () => {
    const standards = await prisma.standard.findMany();
    expect(standards.length).toBe(6); // update if the exemplar set grows
    for (const s of standards) {
      expect(s.categoryId).toBeTruthy();
      const cat = await prisma.category.findUnique({ where: { id: s.categoryId! } });
      expect(cat).not.toBeNull();
    }
  });

  it("VC-001 exists with howToCheck", async () => {
    const s = await prisma.standard.findUnique({ where: { code: "VC-001" } });
    expect(s?.howToCheck.length).toBeGreaterThan(10);
  });
});
```

> **Note:** This test depends on the global test setup (Task 1.6) which starts an in-memory MongoDB, pushes the schema, and runs the seed once. After Task 1.6 is in place, this test passes.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts tests/seed.test.ts
git commit -m "feat(seed): seed 17 categories + exemplar standards"
```

### Task 1.6: Vitest + in-memory MongoDB test setup

**Files:**
- Modify: `vitest.config.ts` *(created in Task 1.1 — add globalSetup + setupFiles)*
- Create: `tests/setupEnv.ts`
- Create: `tests/globalSetup.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Modify `vitest.config.ts` to add global setup + env defaults**

The alias and `environment: "node"` were added in Task 1.1; this step adds `globalSetup` (in-memory Mongo + schema push + seed) and `setupFiles` (env defaults), which finally lets the seed tests from Task 1.5 run green.

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    setupFiles: ["./tests/setupEnv.ts"],
  },
});
```

- [ ] **Step 2: Create `tests/setupEnv.ts` (per-file env defaults so `src/lib/env` parses in tests)**

```ts
// tests/setupEnv.ts
process.env.DATABASE_URL ??= "mongodb://localhost:27017/unused";
process.env.OPENAI_API_KEY ??= "sk-test";
process.env.AUTH_PASSWORD_HASH ??= "$2a$10$testhash";
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-32+";
process.env.OPENAI_MINING_MODEL ??= "gpt-4o-mini";
```

- [ ] **Step 3: Create `tests/globalSetup.ts` (start memory Mongo, push schema, seed)**

```ts
// tests/globalSetup.ts
import { MongoMemoryServer } from "mongodb-memory-server";
import { execSync } from "node:child_process";
import path from "node:path";

let mongo: MongoMemoryServer;

export async function setup() {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  process.env.DATABASE_URL = uri + "test"; // use a named db

  // Apply schema + run seed against the in-memory DB.
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
  execSync("npm run seed", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
}

export async function teardown() {
  if (mongo) await mongo.stop();
}
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: `env` tests (3) + `seed` tests (3) PASS. Memory Mongo starts, schema pushes, seed runs.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/globalSetup.ts tests/setupEnv.ts
git commit -m "test: vitest + in-memory mongo global setup"
```

### Task 1.7: Catalog UI (read-only)

**Files:**
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/catalog/page.tsx`
- Create: `src/app/catalog/[code]/page.tsx`

- [ ] **Step 1: Create `src/app/globals.css`**

```css
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; line-height: 1.5; padding: 1.5rem; max-width: 70rem; margin-inline: auto; }
a { color: #2563eb; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; border-bottom: 1px solid #8884; padding: .4rem .6rem; vertical-align: top; }
.badge { font-size: .75rem; padding: .1rem .4rem; border-radius: 999px; background: #8883; }
.sev-blocker { color: #b91c1c; } .sev-major { color: #b45309; } .sev-minor { color: #4d7c0f; }
```

- [ ] **Step 2: Create `src/app/layout.tsx`**

```tsx
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Dev Standards Dashboard" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
          <a href="/catalog">Catalog</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create `src/app/page.tsx` (redirect to catalog)**

```tsx
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/catalog");
}
```

- [ ] **Step 4: Create `src/app/catalog/page.tsx`**

```tsx
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { standards: { orderBy: { code: "asc" } } },
  });

  return (
    <>
      <h1>Standards Catalog</h1>
      {categories.map((c) => (
        <section key={c.id} style={{ marginBottom: "2rem" }}>
          <h2>{c.name}</h2>
          <p style={{ color: "#888", marginTop: "-.5rem" }}>{c.description}</p>
          {c.standards.length === 0 ? (
            <p style={{ color: "#aaa" }}><em>No standards yet — add via review or mining.</em></p>
          ) : (
            <table>
              <thead><tr><th>Code</th><th>Title</th><th>Severity</th><th>Status</th></tr></thead>
              <tbody>
                {c.standards.map((s) => (
                  <tr key={s.id}>
                    <td><a href={`/catalog/${s.code}`}>{s.code}</a></td>
                    <td>{s.title}</td>
                    <td className={`sev-${s.severity}`}>{s.severity}</td>
                    <td><span className="badge">{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}
```

- [ ] **Step 5: Create `src/app/catalog/[code]/page.tsx`**

```tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StandardDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const standard = await prisma.standard.findUnique({
    where: { code },
    include: { category: true },
  });
  if (!standard) notFound();

  return (
    <>
      <p><a href="/catalog">← Catalog</a></p>
      <h1>{standard.code}: {standard.title}</h1>
      <p><strong>Category:</strong> {standard.category?.name ?? "—"} · <strong>Severity:</strong> {standard.severity} · <strong>Status:</strong> {standard.status}</p>
      <p><strong>Applies to:</strong> {standard.appliesTo.join(", ")}</p>
      <h2>Description</h2>
      <p>{standard.description}</p>
      <h2>How to check</h2>
      <p>{standard.howToCheck}</p>
      {standard.examples && (standard.examples.good || standard.examples.bad) && (
        <>
          <h2>Examples</h2>
          {standard.examples.good && <p><strong>Good:</strong> <code>{standard.examples.good}</code></p>}
          {standard.examples.bad && <p><strong>Bad:</strong> <code>{standard.examples.bad}</code></p>}
        </>
      )}
    </>
  );
}
```

- [ ] **Step 6: Run the dev server and verify**

Run: `npm run dev`
Expected: open `http://localhost:3000` → redirects to `/catalog` → shows 17 categories with the 6 exemplar standards listed; clicking a code shows its detail page. *(Auth is added in Chunk 2; the catalog is currently public.)*

- [ ] **Step 7: Commit**

```bash
git add src/app/
git commit -m "feat(catalog): read-only standards catalog grouped by category"
```

### Chunk 1 verification

- [ ] `npm test` → all env + seed tests pass
- [ ] `npm run dev` → catalog renders with seeded data
- [ ] `git log --oneline` → 7 commits for Chunk 1

---

## Chunk 2: Single-user auth + route protection

**Outcome of this chunk:** every app route requires a signed session cookie; `/login` authenticates against the env-configured bcrypt hash and sets the cookie; `/logout` clears it. The catalog from Chunk 1 is now protected. Pure auth logic (password verify, JWT sign/verify) is unit-tested; the cookie/middleware layer is verified end-to-end.

**Design split (single responsibility):**
- `password.ts` — bcrypt compare only (hashing is done out-of-band via the env-generation command).
- `jwt.ts` — pure sign/verify of the session token (jose). Imported by both middleware (edge) and session.ts (node); no `next/*` dependency, so it's unit-testable.
- `session.ts` — cookie I/O via `next/headers`; wraps `jwt.ts`. Not unit-tested (Next runtime bound); verified via E2E.
- `middleware.ts` — route gating; reads the cookie from `NextRequest` and verifies via `jwt.ts`.

### Task 2.1: Password verification

**Files:**
- Create: `src/lib/auth/password.ts`
- Test: `tests/auth/password.test.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Write the failing test**

```ts
// tests/auth/password.test.ts
import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { verifyPassword } from "@/lib/auth/password";

describe("verifyPassword", () => {
  const hash = bcrypt.hashSync("correct horse", 4); // low cost for test speed

  it("returns true for the correct password", async () => {
    expect(await verifyPassword("correct horse", hash)).toBe(true);
  });

  it("returns false for a wrong password", async () => {
    expect(await verifyPassword("battery staple", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/password.test.ts`
Expected: FAIL — module `@/lib/auth/password` not found.

- [ ] **Step 3: Implement `src/lib/auth/password.ts`**

```ts
import bcrypt from "bcryptjs";

// The hash lives in AUTH_PASSWORD_HASH (env). The app only ever verifies, never hashes.
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth/password.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/password.ts tests/auth/password.test.ts
git commit -m "feat(auth): add bcrypt password verification"
```

### Task 2.2: Session token (sign/verify, pure)

**Files:**
- Create: `src/lib/auth/jwt.ts`
- Test: `tests/auth/jwt.test.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Write the failing test**

```ts
// tests/auth/jwt.test.ts
import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "@/lib/auth/jwt";

describe("session token", () => {
  it("round-trips a freshly signed token", async () => {
    const token = await signSession();
    expect(await verifySession(token)).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const token = await signSession();
    expect(await verifySession(token + "x")).toBe(false);
  });

  it("rejects garbage", async () => {
    expect(await verifySession("not-a-token")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/jwt.test.ts`
Expected: FAIL — module `@/lib/auth/jwt` not found.

- [ ] **Step 3: Implement `src/lib/auth/jwt.ts`**

```ts
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

export const COOKIE_NAME = "dsd_session";

const encoder = new TextEncoder();
const key = () => encoder.encode(env.SESSION_SECRET);

export async function signSession(): Promise<string> {
  return new SignJWT({ authed: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key());
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, key());
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth/jwt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/jwt.ts tests/auth/jwt.test.ts
git commit -m "feat(auth): add jose session token sign/verify"
```

### Task 2.3: Session cookie I/O (server components/actions)

**Files:**
- Create: `src/lib/auth/session.ts`

- [ ] **Step 1: Implement `src/lib/auth/session.ts`**

Wraps `jwt.ts` with `next/headers` cookie access. Used by server actions and server components (not middleware — middleware uses `jwt.ts` directly via `NextRequest.cookies`).

```ts
import { cookies } from "next/headers";
import { signSession, verifySession, COOKIE_NAME } from "@/lib/auth/jwt";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function createSession(): Promise<void> {
  const token = await signSession();
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySession(token);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth/session.ts
git commit -m "feat(auth): add cookie session I/O via next/headers"
```

### Task 2.4: Route protection middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Implement `src/middleware.ts`**

Guards everything except `/login` and static assets. Redirects unauthenticated requests to `/login?next=<original>`. Reads the cookie from `NextRequest` (not `next/headers`, which is unavailable in middleware).

```ts
import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE_NAME } from "@/lib/auth/jwt";

const PUBLIC = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const ok = token ? await verifySession(token) : false;
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): protect all routes except /login"
```

### Task 2.5: Login page + server action

**Files:**
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/LoginForm.tsx`
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Create the login server action `src/app/login/actions.ts`**

Returns an error object on failure; redirects on success. Using `useActionState` (React 19) lets the form show inline errors without a query string.

```ts
"use server";

import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";

export type LoginState = { error?: string } | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const ok = await verifyPassword(password, env.AUTH_PASSWORD_HASH);
  if (!ok) return { error: "Incorrect password." };
  await createSession();
  const next = String(formData.get("next") ?? "/catalog");
  // Only allow single-slash internal paths; reject "//" (protocol-relative) and "\\" (backslash-normalized) to prevent open redirect.
  redirect(next.startsWith("/") && !next.startsWith("//") && !next.startsWith("\\") ? next : "/catalog");
}
```

> `redirect()` throws internally and never returns; the return type only applies to the failure path.

- [ ] **Step 2: Create the client form `src/app/login/LoginForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, null);
  return (
    <form action={formAction} style={{ display: "grid", gap: "0.75rem", maxWidth: "20rem" }}>
      <input type="hidden" name="next" value={next} />
      <label>
        Password
        <input type="password" name="password" required autoComplete="current-password" />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      {state?.error && <p style={{ color: "#b91c1c" }}>{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Create `src/app/login/page.tsx`**

```tsx
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/catalog" } = await searchParams;
  return (
    <>
      <h1>Sign in</h1>
      <LoginForm next={next} />
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/login/
git commit -m "feat(auth): add login page with server action + inline errors"
```

### Task 2.6: Logout + nav update + end-to-end verification

**Files:**
- Create: `src/app/logout/route.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/app/logout/route.ts` (POST-only)**

Logout is POST (not GET) so link prefetch / crawlers / accidental navigation can't trigger it.

```ts
import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth/session";

export async function POST() {
  await destroySession();
  redirect("/login");
}
```

- [ ] **Step 2: Update `src/app/layout.tsx` nav to include a Logout button (POST form)**

A plain HTML form posting to `/logout` keeps it POST without client JS.

Replace the `<nav>` block with:

```tsx
<nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
  <a href="/catalog">Catalog</a>
  <form action="/logout" method="post" style={{ marginLeft: "auto" }}>
    <button type="submit" style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0, font: "inherit" }}>
      Logout
    </button>
  </form>
</nav>
```

- [ ] **Step 3: Run unit tests**

Run: `npm test`
Expected: all Chunk 1 tests + password (2) + jwt (3) PASS.

- [ ] **Step 4: Verify end-to-end manually**

Run: `npm run dev`
Expected:
1. Visit `http://localhost:3000/catalog` → redirected to `/login?next=/catalog`.
2. Submit a wrong password → inline "Incorrect password." error, still on `/login`.
3. Submit the password matching `AUTH_PASSWORD_HASH` → redirected to `/catalog`, standards visible.
4. Refresh `/catalog` → still authenticated (cookie persists).
5. Click Logout → returned to `/login`; visiting `/catalog` again redirects to login.

- [ ] **Step 5: Commit**

```bash
git add src/app/logout/route.ts src/app/layout.tsx
git commit -m "feat(auth): add logout route and nav link"
```

### Chunk 2 verification

- [ ] `npm test` → env + seed + password + jwt tests pass
- [ ] Unauthenticated `/catalog` → redirects to `/login`
- [ ] Correct password → authenticated; wrong password → inline error
- [ ] Logout clears the session

---

## Chunk 3: Conversation ingestion + parsing + UI

**Outcome of this chunk:** the user can paste an Upwork conversation (title, developer name, raw text) through the UI; it is stored and parsed into speaker turns; conversations are listed and viewable. (Mining runs in Chunk 4; the conversation detail page here shows parsed messages only.)

**Parser note:** the parser is heuristic — it splits on `Author: ...` / `Author — ...` style lines and tags the freelancer role when an author matches the supplied developer name. It will not be perfect on pasted code/JSON, and that's fine: mining (Chunk 4) is robust to imperfect segmentation because each proposed pattern carries direct-quote evidence the human reviews.

### Task 3.1: Conversation parser

**Files:**
- Create: `src/lib/conversations/parse.ts`
- Test: `tests/conversations/parse.test.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Write the failing test**

```ts
// tests/conversations/parse.test.ts
import { describe, it, expect } from "vitest";
import { parseConversation } from "@/lib/conversations/parse";

describe("parseConversation", () => {
  it("splits speaker turns", () => {
    const msgs = parseConversation("Alice: hello\nBob: hi there");
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ author: "Alice", content: "hello" });
    expect(msgs[1]).toMatchObject({ author: "Bob", content: "hi there" });
  });

  it("tags the freelancer when author matches developerName", () => {
    const msgs = parseConversation("Alice: hi\nBob: sure", "Bob");
    expect(msgs.find((m) => m.author === "Bob")?.role).toBe("freelancer");
    expect(msgs.find((m) => m.author === "Alice")?.role).toBe("client");
  });

  it("collects multi-line content into one message", () => {
    const msgs = parseConversation("Alice: line one\nstill alice\nBob: ok");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe("line one\nstill alice");
  });

  it("returns a single message when no speakers are detected", () => {
    const msgs = parseConversation("just a blob of text\nwith two lines");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toContain("blob of text");
  });

  it("ignores a bracketed timestamp in the speaker line", () => {
    const msgs = parseConversation("Alice (10:00): hello");
    expect(msgs[0]).toMatchObject({ author: "Alice", content: "hello" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/conversations/parse.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/conversations/parse.ts`**

```ts
export type ParsedMessage = {
  role: string;        // "freelancer" | "client" | "unknown"
  author: string;
  content: string;
  timestamp: string | null;
};

// Matches "Author: ...", "Author — ...", or "Author - ...", optionally with a bracketed timestamp.
const SPEAKER_RE = /^(?<author>[A-Za-z][A-Za-z0-9 .'_-]{0,60}?)\s*(?:[[(
][^\])]*[\])])?\s*[:—-]\s*(?<rest>.*)$/;

function matchesDeveloper(author: string, dev: string | undefined): boolean {
  if (!dev) return false;
  const a = author.trim().toLowerCase();
  const d = dev.trim().toLowerCase();
  return a.length > 0 && (a.includes(d) || d.includes(a));
}

export function parseConversation(raw: string, developerName?: string): ParsedMessage[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: ParsedMessage[] = [];
  let cur: ParsedMessage | null = null;

  const push = () => {
    if (cur && (cur.content.trim() || cur.author.trim())) out.push(cur);
    cur = null;
  };

  for (const line of lines) {
    const m = SPEAKER_RE.exec(line);
    if (m && m.groups && m.groups.author.trim()) {
      push();
      cur = {
        role: matchesDeveloper(m.groups.author, developerName) ? "freelancer" : "client",
        author: m.groups.author.trim(),
        content: m.groups.rest ?? "",
        timestamp: null,
      };
    } else if (cur) {
      cur.content += (cur.content ? "\n" : "") + line;
    } else {
      cur = { role: "client", author: "", content: line, timestamp: null };
    }
  }
  push();
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/conversations/parse.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/conversations/parse.ts tests/conversations/parse.test.ts
git commit -m "feat(conversations): add heuristic conversation parser"
```

### Task 3.2: Ingest + list API

**Files:**
- Create: `src/app/api/conversations/route.ts`
- Test: `tests/api/conversations.test.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/conversations.test.ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/conversations/route";
import { prisma } from "@/lib/db";

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/api/conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/conversations", () => {
  it("creates a conversation with parsed messages and a developer", async () => {
    const res = await POST(jsonReq({ title: "Chat 1", developerName: "Alice", rawText: "Alice: hello\nBob: hi" }));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const conv = await prisma.conversation.findUnique({ where: { id } });
    expect(conv?.parsedMessages).toHaveLength(2);
    expect(conv?.status).toBe("ingested");
    expect(await prisma.developer.findFirst({ where: { name: "Alice" } })).not.toBeNull();
  });

  it("reuses an existing developer with the same exact name (no duplicate)", async () => {
    // Isolate from other tests so this case is order-independent.
    await prisma.developer.deleteMany({ where: { name: "Alice" } });
    await prisma.developer.create({ data: { name: "Alice" } });
    const before = await prisma.developer.count({ where: { name: "Alice" } });
    await POST(jsonReq({ title: "Chat 2", developerName: "Alice", rawText: "Alice: yo" }));
    const after = await prisma.developer.count({ where: { name: "Alice" } });
    expect(after).toBe(before); // reused, not duplicated
  });

  it("rejects invalid input with 400", async () => {
    const res = await POST(jsonReq({ title: "" }));
    expect(res.status).toBe(400);
  });
});
```

> Tests share the in-memory DB; data accumulates across cases in this file, which the assertions account for (counts are relative). Acceptable for Phase 1.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/conversations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/api/conversations/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseConversation } from "@/lib/conversations/parse";

const Body = z.object({
  title: z.string().min(1),
  developerName: z.string().min(1),
  rawText: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, developerName, rawText } = parsed.data;
  const messages = parseConversation(rawText, developerName);

  // Materialize one bare Developer per distinct exact name (spec §4.7). Alias/variant merge is Phase 3.
  const existing = await prisma.developer.findFirst({ where: { name: developerName } });
  const developer = existing ?? (await prisma.developer.create({ data: { name: developerName } }));

  const conversation = await prisma.conversation.create({
    data: { title, developerName, developerId: developer.id, rawText, parsedMessages: messages, status: "ingested" },
  });
  return NextResponse.json({ id: conversation.id }, { status: 201 });
}

export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: "desc" },
    include: { developer: true },
  });
  return NextResponse.json(conversations);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/conversations.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/conversations/route.ts tests/api/conversations.test.ts
git commit -m "feat(conversations): add ingest + list API"
```

### Task 3.3: Conversations list + ingest form

**Files:**
- Create: `src/app/conversations/IngestForm.tsx`
- Create: `src/app/conversations/page.tsx`

- [ ] **Step 1: Create the client ingest form `src/app/conversations/IngestForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IngestForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [developerName, setDeveloperName] = useState("");
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, developerName, rawText }),
    });
    setBusy(false);
    if (!res.ok) { setError("Failed to ingest conversation."); return; }
    const { id } = await res.json();
    router.push(`/conversations/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: "48rem", marginTop: "1rem" }}>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input placeholder="Developer name" value={developerName} onChange={(e) => setDeveloperName(e.target.value)} required />
      <textarea placeholder="Paste the full conversation here…" value={rawText}
        onChange={(e) => setRawText(e.target.value)} required rows={12} style={{ fontFamily: "ui-monospace, monospace" }} />
      <button type="submit" disabled={busy}>{busy ? "Ingesting…" : "Ingest conversation"}</button>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Create `src/app/conversations/page.tsx`**

```tsx
import { prisma } from "@/lib/db";
import { IngestForm } from "./IngestForm";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: "desc" },
    include: { developer: true },
  });
  return (
    <>
      <h1>Conversations</h1>
      <h2>Ingest a new conversation</h2>
      <IngestForm />

      <h2 style={{ marginTop: "2rem" }}>Past conversations</h2>
      {conversations.length === 0 ? (
        <p style={{ color: "#aaa" }}><em>None yet.</em></p>
      ) : (
        <table>
          <thead><tr><th>Title</th><th>Developer</th><th>Status</th><th>Messages</th></tr></thead>
          <tbody>
            {conversations.map((c) => (
              <tr key={c.id}>
                <td><a href={`/conversations/${c.id}`}>{c.title}</a></td>
                <td>{c.developer?.name ?? c.developerName}</td>
                <td><span className="badge">{c.status}</span></td>
                <td>{c.parsedMessages.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/conversations/IngestForm.tsx src/app/conversations/page.tsx
git commit -m "feat(conversations): list page + ingest form"
```

### Task 3.4: Conversation detail page

**Files:**
- Create: `src/app/conversations/[id]/page.tsx`

- [ ] **Step 1: Create `src/app/conversations/[id]/page.tsx`**

```tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = await prisma.conversation.findUnique({ where: { id }, include: { developer: true } });
  if (!conv) notFound();

  return (
    <>
      <p><a href="/conversations">← Conversations</a></p>
      <h1>{conv.title}</h1>
      <p>
        <strong>Developer:</strong> {conv.developer?.name ?? conv.developerName} ·{" "}
        <strong>Status:</strong> <span className="badge">{conv.status}</span>
      </p>

      <h2>Messages</h2>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {conv.parsedMessages.map((m, i) => (
          <div key={i} style={{
            padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
            background: m.role === "freelancer" ? "#eef2ff" : "#f3f4f6",
          }}>
            <strong>{m.author || "—"}</strong>{" "}
            <span className="badge">{m.role}</span>
            <pre style={{ whiteSpace: "pre-wrap", margin: "0.25rem 0 0", fontFamily: "inherit" }}>{m.content}</pre>
          </div>
        ))}
      </div>

      <p style={{ color: "#888", marginTop: "1.5rem" }}><em>AI pattern-mining arrives in Phase 1 Chunk 4.</em></p>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/conversations/[id]/page.tsx
git commit -m "feat(conversations): detail page with parsed messages"
```

### Task 3.5: Nav update + end-to-end verification

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add a Conversations link to the nav**

In `src/app/layout.tsx`, add `<a href="/conversations">Conversations</a>` next to the Catalog link inside `<nav>`.

- [ ] **Step 2: Run unit + integration tests**

Run: `npm test`
Expected: all prior tests + parser (5) + ingest API (3) PASS.

- [ ] **Step 3: Verify end-to-end manually**

Run: `npm run dev`
Expected (while signed in):
1. `/conversations` shows the ingest form and an empty list.
2. Paste a sample conversation with `Name: …` lines → on submit, redirected to its detail page showing parsed, role-tagged messages.
3. Back on `/conversations`, the new conversation appears in the table with the developer name and message count.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(nav): link to conversations"
```

### Chunk 3 verification

- [ ] `npm test` → all prior + parser + ingest API tests pass
- [ ] Ingest form stores a conversation and parses it into messages
- [ ] Detail page renders role-tagged messages
- [ ] Same developer name is not duplicated across ingests

---

## Chunk 4: Worker + Job table + OpenAI mining pipeline + dedupe

**Outcome of this chunk:** clicking "Mine" on a conversation enqueues a `mine-patterns` job; a background worker claims it atomically, calls OpenAI (structured output) to extract evidence-backed patterns, de-duplicates them against existing standards/patterns, stores the net-new ones as `proposed` Patterns, and marks the job done with its token cost. Nothing here becomes a Standard — approval is Chunk 5.

**Testing approach:** OpenAI is never called from tests. The mining function is tested with a mocked client (`vi.mock`); the job handler is tested with a mocked `minePatterns`; claim/dedupe are pure-logic unit tests. The infinite poll loop itself is verified by running the worker manually.

**Dependency note:** the worker process runs under `tsx` (not Next), so it must load `.env` itself via `dotenv` (added in Task 4.7). `import "dotenv/config"` is the first line of the worker entry so env vars exist before `src/lib/env` is imported transitively.

### Task 4.1: OpenAI client singleton

**Files:**
- Create: `src/lib/openai/client.ts`

- [ ] **Step 1: Implement `src/lib/openai/client.ts`**

```ts
import OpenAI from "openai";
import { env } from "@/lib/env";

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/openai/client.ts
git commit -m "feat(openai): add client singleton"
```

### Task 4.2: Structured-output schema for mining

**Files:**
- Create: `src/lib/openai/schemas.ts`

- [ ] **Step 1: Implement `src/lib/openai/schemas.ts`**

Each proposed pattern must carry **at least one direct-quote evidence** — enforced by the schema, this is the evidence-first anti-hallucination control from spec §6.4.

```ts
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

export const ProposedPattern = z.object({
  description: z.string(),
  suggestedCategory: z.string().nullable(),
  severity: z.enum(["blocker", "major", "minor"]),
  occurrences: z.number().int().min(1),
  suggestedStandardText: z.string().nullable(),
  evidence: z.array(z.object({ quote: z.string() })).min(1), // ≥1 direct quote, always
});

export const MiningResult = z.object({
  patterns: z.array(ProposedPattern),
});

export const miningResponseFormat = zodResponseFormat(MiningResult, "mining_result");
export type ProposedPatternT = z.infer<typeof ProposedPattern>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/openai/schemas.ts
git commit -m "feat(openai): add mining structured-output schema (evidence-first)"
```

### Task 4.3: Mining function (tested with a mocked client)

**Files:**
- Create: `src/lib/openai/mining.ts`
- Test: `tests/openai/mining.test.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Write the failing test**

```ts
// tests/openai/mining.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above imports, so the factory can't close over a top-level const.
// vi.hoisted lifts the mock fn so it exists when the (hoisted) factory runs.
const { parseMock } = vi.hoisted(() => ({ parseMock: vi.fn() }));
vi.mock("@/lib/openai/client", () => ({
  openai: { beta: { chat: { completions: { parse: parseMock } } } },
}));

import { minePatterns } from "@/lib/openai/mining";

const SAMPLE = {
  description: "Functions include JSDoc parameter annotations",
  suggestedCategory: "Documentation",
  severity: "minor" as const,
  occurrences: 3,
  suggestedStandardText: "Document all function parameters.",
  evidence: [{ quote: "Alice: I always annotate params with JSDoc" }],
};

beforeEach(() => parseMock.mockReset());

it("returns parsed patterns and token usage", async () => {
  parseMock.mockResolvedValue({
    choices: [{ message: { parsed: { patterns: [SAMPLE] } } }],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
  });
  const out = await minePatterns({
    messages: [{ author: "Alice", content: "I always annotate params with JSDoc" }],
    existingStandardCodes: [],
    existingPatternDescriptions: [],
    categoryNames: ["Documentation"],
  });
  expect(out.patterns).toHaveLength(1);
  expect(out.patterns[0].evidence[0].quote).toContain("JSDoc");
  expect(out.usage.totalTokens).toBe(120);
});

it("returns an empty pattern list when the model returns none", async () => {
  parseMock.mockResolvedValue({ choices: [{ message: { parsed: { patterns: [] } } }], usage: { total_tokens: 5, prompt_tokens: 5, completion_tokens: 0 } });
  const out = await minePatterns({ messages: [], existingStandardCodes: [], existingPatternDescriptions: [], categoryNames: [] });
  expect(out.patterns).toEqual([]);
});

it("passes existing standard codes and category names into the prompt", async () => {
  parseMock.mockResolvedValue({ choices: [{ message: { parsed: { patterns: [] } } }], usage: { total_tokens: 1, prompt_tokens: 1, completion_tokens: 0 } });
  await minePatterns({ messages: [{ author: "A", content: "x" }], existingStandardCodes: ["VC-001"], existingPatternDescriptions: [], categoryNames: ["Testing"] });
  const call = parseMock.mock.calls[0][0];
  const userContent = call.messages.find((m: { role: string }) => m.role === "user").content;
  expect(userContent).toContain("VC-001");
  expect(userContent).toContain("Testing");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/openai/mining.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/openai/mining.ts`**

```ts
import { openai } from "@/lib/openai/client";
import { miningResponseFormat, type ProposedPatternT } from "@/lib/openai/schemas";
import { env } from "@/lib/env";

export interface MiningUsage { promptTokens: number; completionTokens: number; totalTokens: number; }

export async function minePatterns(input: {
  messages: { author: string; content: string }[];
  existingStandardCodes: string[];
  existingPatternDescriptions: string[];
  categoryNames: string[];
}): Promise<{ patterns: ProposedPatternT[]; usage: MiningUsage }> {
  const transcript = input.messages.map((m) => `${m.author}: ${m.content}`).join("\n");

  const completion = await openai.beta.chat.completions.parse({
    model: env.OPENAI_MINING_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You analyze a chat conversation between a client and a software freelancer.",
          "Extract RECURRING or NOTABLE patterns relevant to software-development standards:",
          "good practices followed, bad practices or violations, and unique notable details.",
          "For each pattern give: a concise description, a suggested category (use one of the listed category names if possible),",
          "severity (blocker/major/minor), an occurrences count, suggested standard text, and AT LEAST ONE direct-quote evidence",
          "from the transcript. Never fabricate quotes. Omit any pattern without real evidence.",
          "Do NOT re-propose known patterns. Known standard codes and pattern descriptions are listed — skip semantically identical ones.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "CATEGORY NAMES: " + input.categoryNames.join(", "),
          "EXISTING STANDARD CODES: " + (input.existingStandardCodes.join(", ") || "(none)"),
          "EXISTING PATTERN DESCRIPTIONS:\n" + (input.existingPatternDescriptions.join("\n") || "(none)"),
          "TRANSCRIPT:\n" + transcript,
        ].join("\n\n"),
      },
    ],
    response_format: miningResponseFormat,
  });

  const parsed = completion.choices[0]?.message.parsed;
  const u = completion.usage;
  return {
    patterns: parsed?.patterns ?? [],
    usage: {
      promptTokens: u?.prompt_tokens ?? 0,
      completionTokens: u?.completion_tokens ?? 0,
      totalTokens: u?.total_tokens ?? 0,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/openai/mining.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/openai/mining.ts tests/openai/mining.test.ts
git commit -m "feat(openai): add mining function (structured output, evidence-first)"
```

### Task 4.4: Pattern de-duplication

**Files:**
- Create: `src/lib/patterns/dedupe.ts`
- Test: `tests/patterns/dedupe.test.ts`

@superpowers:test-driven-development

A safety net behind the model's own skip-known behavior. Phase 1 uses token-overlap (Jaccard) similarity; embedding-based semantic matching is a future enhancement (spec §6.1).

- [ ] **Step 1: Write the failing test**

```ts
// tests/patterns/dedupe.test.ts
import { describe, it, expect } from "vitest";
import { dedupeProposed } from "@/lib/patterns/dedupe";

const P = (description: string) => ({ description, suggestedCategory: null, severity: "minor" as const, occurrences: 1, suggestedStandardText: null, evidence: [{ quote: "q" }] });

describe("dedupeProposed", () => {
  it("keeps a pattern with no similar existing entry", () => {
    const { fresh, duplicates } = dedupeProposed([P("Use conventional commit messages everywhere")], { descriptions: [] });
    expect(fresh).toHaveLength(1);
    expect(duplicates).toHaveLength(0);
  });

  it("filters a proposed pattern that closely matches an existing standard", () => {
    const { fresh, duplicates } = dedupeProposed(
      [P("commits should follow conventional commit message format")],
      { descriptions: ["Commit subjects follow Conventional Commits format"] },
    );
    expect(fresh).toHaveLength(0);
    expect(duplicates).toHaveLength(1);
  });

  it("passes through unrelated patterns", () => {
    const { fresh } = dedupeProposed(
      [P("All API responses include a correlation id"), P("Database indexes on foreign keys")],
      { descriptions: ["Use conventional commit messages"] },
    );
    expect(fresh).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/patterns/dedupe.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/patterns/dedupe.ts`**

```ts
import type { ProposedPatternT } from "@/lib/openai/schemas";

const STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "for", "is", "are", "on", "with", "that", "this", "it", "as", "by", "at", "be", "should", "must", "all", "use"]);

function tokens(s: string): Set<string> {
  return new Set(
    (s.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? [])
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export const DEDUPE_THRESHOLD = 0.5;

export function dedupeProposed(
  proposed: ProposedPatternT[],
  existing: { descriptions: string[] },
  threshold: number = DEDUPE_THRESHOLD,
): { fresh: ProposedPatternT[]; duplicates: ProposedPatternT[] } {
  const existingSets = existing.descriptions.map(tokens);
  const fresh: ProposedPatternT[] = [];
  const duplicates: ProposedPatternT[] = [];
  for (const p of proposed) {
    const ps = tokens(p.description);
    const isDup = existingSets.some((es) => jaccard(ps, es) >= threshold);
    (isDup ? duplicates : fresh).push(p);
  }
  return { fresh, duplicates };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/patterns/dedupe.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/patterns/dedupe.ts tests/patterns/dedupe.test.ts
git commit -m "feat(patterns): add token-overlap de-duplication"
```

### Task 4.5: Atomic job claim

**Files:**
- Create: `src/worker/claim.ts`
- Test: `tests/worker/claim.test.ts`

@superpowers:test-driven-development

Claim uses Prisma `updateMany` as a compare-and-swap (`where status: queued`) so two worker instances can't both run the same job — the MongoDB "no native row lock" concern from the spec review is handled here.

- [ ] **Step 1: Write the failing test**

```ts
// tests/worker/claim.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { claimNextJob } from "@/worker/claim";

async function seedJobs(n: number) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const j = await prisma.job.create({ data: { type: "mine-patterns", status: "queued" } });
    ids.push(j.id);
  }
  return ids;
}

describe("claimNextJob", () => {
  beforeEach(async () => { await prisma.job.deleteMany({}); });

  it("claims the oldest queued job and marks it running", async () => {
    const [first] = await seedJobs(2);
    const job = await claimNextJob();
    expect(job?.id).toBe(first);
    const updated = await prisma.job.findUnique({ where: { id: first } });
    expect(updated?.status).toBe("running");
    expect(updated?.startedAt).not.toBeNull();
  });

  it("returns null when nothing is queued", async () => {
    expect(await claimNextJob()).toBeNull();
  });

  it("skips a running job and claims the queued one", async () => {
    const running = await prisma.job.create({ data: { type: "mine-patterns", status: "running", startedAt: new Date() } });
    const [queued] = await seedJobs(1);
    const claimed = await claimNextJob();
    expect(claimed?.id).toBe(queued);
    expect(claimed?.id).not.toBe(running.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worker/claim.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/worker/claim.ts`**

```ts
import { prisma } from "@/lib/db";

export async function claimNextJob() {
  const next = await prisma.job.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!next) return null;
  // Compare-and-swap: only transitions queued → running. If another worker won the race, count is 0.
  const res = await prisma.job.updateMany({
    where: { id: next.id, status: "queued" },
    data: { status: "running", startedAt: new Date() },
  });
  return res.count === 1 ? next : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worker/claim.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/worker/claim.ts tests/worker/claim.test.ts
git commit -m "feat(worker): add atomic job claim (compare-and-swap)"
```

### Task 4.6: Mining job handler (tested with mocked mining)

**Files:**
- Create: `src/worker/handlers/mine.ts`
- Test: `tests/worker/handlers/mine.test.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Write the failing test**

```ts
// tests/worker/handlers/mine.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

const { mineMock } = vi.hoisted(() => ({ mineMock: vi.fn() }));
vi.mock("@/lib/openai/mining", () => ({ minePatterns: mineMock }));

import { runMineJob } from "@/worker/handlers/mine";

const SAMPLE = [{
  description: "Functions include JSDoc parameter annotations",
  suggestedCategory: "Documentation",
  severity: "minor" as const,
  occurrences: 3,
  suggestedStandardText: "Document all function parameters.",
  evidence: [{ quote: "Alice: I always annotate params with JSDoc" }],
}];

beforeEach(() => mineMock.mockReset());

it("stores proposed patterns, marks job done, and records token cost", async () => {
  mineMock.mockResolvedValue({ patterns: SAMPLE, usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 } });

  const conv = await prisma.conversation.create({
    data: { title: "T", developerName: "Alice", rawText: "Alice: I always annotate params with JSDoc",
      parsedMessages: [{ role: "freelancer", author: "Alice", content: "I always annotate params with JSDoc", timestamp: null }], status: "ingested" },
  });
  const job = await prisma.job.create({ data: { type: "mine-patterns", targetType: "conversation", targetId: conv.id, status: "queued" } });

  await runMineJob(job.id);

  const updated = await prisma.job.findUnique({ where: { id: job.id } });
  expect(updated?.status).toBe("done");
  expect(updated?.tokenCost).toBe(120);

  const patterns = await prisma.pattern.findMany({ where: { fromConversationId: conv.id } });
  expect(patterns).toHaveLength(1);
  expect(patterns[0].status).toBe("proposed");
  expect(patterns[0].evidence[0].quote).toContain("JSDoc");

  const convo = await prisma.conversation.findUnique({ where: { id: conv.id } });
  expect(convo?.status).toBe("analyzed");
});

it("marks the job failed when the conversation is missing", async () => {
  const job = await prisma.job.create({ data: { type: "mine-patterns", targetId: "000000000000000000000000", status: "queued" } });
  await runMineJob(job.id);
  const updated = await prisma.job.findUnique({ where: { id: job.id } });
  expect(updated?.status).toBe("failed");
  expect(updated?.error).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worker/handlers/mine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/worker/handlers/mine.ts`**

```ts
import { prisma } from "@/lib/db";
import { minePatterns } from "@/lib/openai/mining";
import { dedupeProposed } from "@/lib/patterns/dedupe";

async function failJob(jobId: string, error: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "failed", error, finishedAt: new Date() },
  });
}

export async function runMineJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.type !== "mine-patterns" || !job.targetId) {
    await failJob(jobId, "Invalid mining job");
    return;
  }
  const conversation = await prisma.conversation.findUnique({ where: { id: job.targetId } });
  if (!conversation) { await failJob(jobId, "Conversation not found"); return; }

  const [standards, existingPatterns, categories] = await Promise.all([
    prisma.standard.findMany({ select: { code: true, description: true } }),
    prisma.pattern.findMany({ where: { status: "proposed" }, select: { description: true } }),
    prisma.category.findMany({ select: { name: true } }),
  ]);
  const existingDescriptions = [...standards.map((s) => s.description), ...existingPatterns.map((p) => p.description)];

  try {
    const { patterns, usage } = await minePatterns({
      messages: conversation.parsedMessages.map((m) => ({ author: m.author, content: m.content })),
      existingStandardCodes: standards.map((s) => s.code),
      existingPatternDescriptions: existingDescriptions,
      categoryNames: categories.map((c) => c.name),
    });

    const { fresh, duplicates } = dedupeProposed(patterns, { descriptions: existingDescriptions });

    // Create one-by-one (MongoDB-connector-safe) rather than createMany in a transaction.
    for (const p of fresh) {
      await prisma.pattern.create({
        data: {
          fromConversationId: conversation.id,
          description: p.description,
          suggestedCategory: p.suggestedCategory,
          severity: p.severity,
          occurrences: p.occurrences,
          suggestedStandardText: p.suggestedStandardText,
          evidence: p.evidence.map((e) => ({ quote: e.quote })),
          status: "proposed",
        },
      });
    }

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "done",
        progress: 100,
        finishedAt: new Date(),
        tokenCost: usage.totalTokens,
        result: { proposedCount: fresh.length, duplicatesFiltered: duplicates.length },
      },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "analyzed" } });
  } catch (err) {
    await failJob(jobId, err instanceof Error ? err.message : String(err));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worker/handlers/mine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/worker/handlers/mine.ts tests/worker/handlers/mine.test.ts
git commit -m "feat(worker): add mining job handler with dedupe"
```

### Task 4.7: Worker poll loop

**Files:**
- Create: `src/worker/index.ts`

- [ ] **Step 1: Install `dotenv` (the tsx worker process needs to load `.env` itself)**

Run: `npm install dotenv`

- [ ] **Step 2: Create `src/worker/stale.ts` (extracted so it's unit-testable)**

Kept separate from the poll-loop entry so it can be tested without running `main()`. A job stuck in `running` longer than 5 minutes is requeued (spec §6.5 robustness).

```ts
import { prisma } from "@/lib/db";

export const STALE_MS = 5 * 60 * 1000;

export async function requeueStaleJobs(now: number = Date.now()): Promise<number> {
  const cutoff = new Date(now - STALE_MS);
  const res = await prisma.job.updateMany({
    where: { status: "running", startedAt: { lt: cutoff } },
    data: { status: "queued", startedAt: null },
  });
  return res.count;
}
```

- [ ] **Step 3: Create `src/worker/index.ts` (poll loop)**

`import "dotenv/config"` is the first line so env vars load before `src/lib/env` is imported transitively. Each tick requeues stale jobs then claims the next job.

```ts
import "dotenv/config";
import { prisma } from "@/lib/db";
import { claimNextJob } from "@/worker/claim";
import { requeueStaleJobs } from "@/worker/stale";
import { runMineJob } from "@/worker/handlers/mine";

const POLL_MS = 5000;

async function tick() {
  await requeueStaleJobs();
  const job = await claimNextJob();
  if (!job) return;
  if (job.type === "mine-patterns") {
    await runMineJob(job.id);
  } else {
    // grade jobs are Phase 2
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "failed", error: `Unsupported job type: ${job.type}`, finishedAt: new Date() },
    });
  }
}

async function main() {
  console.log(`[worker] polling every ${POLL_MS}ms`);
  while (true) {
    try { await tick(); } catch (e) { console.error("[worker] tick error:", e); }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
```

- [ ] **Step 4: Write the stale-recovery test**

```ts
// tests/worker/stale.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { requeueStaleJobs, STALE_MS } from "@/worker/stale";

describe("requeueStaleJobs", () => {
  beforeEach(async () => { await prisma.job.deleteMany({}); });

  it("requeues a running job older than the stale window", async () => {
    const old = new Date(Date.now() - STALE_MS - 60_000);
    await prisma.job.create({ data: { type: "mine-patterns", status: "running", startedAt: old } });
    const count = await requeueStaleJobs();
    expect(count).toBe(1);
    const jobs = await prisma.job.findMany();
    expect(jobs[0].status).toBe("queued");
  });

  it("leaves a recently-started running job alone", async () => {
    await prisma.job.create({ data: { type: "mine-patterns", status: "running", startedAt: new Date() } });
    expect(await requeueStaleJobs()).toBe(0);
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add src/worker/stale.ts src/worker/index.ts tests/worker/stale.test.ts package.json package-lock.json
git commit -m "feat(worker): add poll loop + tested stale-job recovery"
```

### Task 4.8: Enqueue-mining API

**Files:**
- Create: `src/app/api/conversations/[id]/mine/route.ts`
- Test: `tests/api/conversations-mine.test.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/conversations-mine.test.ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/conversations/[id]/mine/route";
import { prisma } from "@/lib/db";

function req(id: string) {
  return new NextRequest(`http://localhost/api/conversations/${id}/mine`, { method: "POST" });
}

describe("POST /api/conversations/[id]/mine", () => {
  it("enqueues a queued mine-patterns job (202)", async () => {
    const conv = await prisma.conversation.create({ data: { title: "T", developerName: "A", rawText: "A: hi", parsedMessages: [], status: "ingested" } });
    const res = await POST(req(conv.id), { params: Promise.resolve({ id: conv.id }) });
    expect(res.status).toBe(202);
    const { jobId } = await res.json();
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job?.type).toBe("mine-patterns");
    expect(job?.status).toBe("queued");
  });

  it("returns 404 for a missing conversation", async () => {
    const res = await POST(req("000000000000000000000000"), { params: Promise.resolve({ id: "000000000000000000000000" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/conversations-mine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/api/conversations/[id]/mine/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = await prisma.job.create({
    data: { type: "mine-patterns", targetType: "conversation", targetId: id, status: "queued" },
  });
  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/conversations-mine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/conversations/[id]/mine/route.ts tests/api/conversations-mine.test.ts
git commit -m "feat(api): add enqueue-mining endpoint"
```

### Task 4.9: Mine button + job status on the conversation detail page

**Files:**
- Create: `src/app/conversations/[id]/MineButton.tsx`
- Modify: `src/app/conversations/[id]/page.tsx`

- [ ] **Step 1: Create `src/app/conversations/[id]/MineButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MineButton({ conversationId, jobStatus }: { conversationId: string; jobStatus?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Disable while a job is already queued/running to avoid duplicate OpenAI spend.
  const inFlight = jobStatus === "queued" || jobStatus === "running";

  async function onMine() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/conversations/${conversationId}/mine`, { method: "POST" });
    setBusy(false);
    if (!res.ok) { setError("Failed to start mining."); return; }
    router.refresh();
  }

  const label = busy ? "Queuing…" : inFlight ? `Mining… (${jobStatus})` : "⛏ Mine for patterns";

  return (
    <>
      <button type="button" onClick={onMine} disabled={busy || inFlight}>{label}</button>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
    </>
  );
}
```

- [ ] **Step 2: Update `src/app/conversations/[id]/page.tsx`**

Add mining status + the button. Replace the file body (after the `conv` null-check) to include the latest job for this conversation and a count of proposed patterns:

```tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { MineButton } from "./MineButton";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = await prisma.conversation.findUnique({ where: { id }, include: { developer: true } });
  if (!conv) notFound();

  const [latestJob, proposedCount] = await Promise.all([
    prisma.job.findFirst({ where: { targetId: id }, orderBy: { createdAt: "desc" } }),
    prisma.pattern.count({ where: { fromConversationId: id, status: "proposed" } }),
  ]);

  return (
    <>
      <p><a href="/conversations">← Conversations</a></p>
      <h1>{conv.title}</h1>
      <p>
        <strong>Developer:</strong> {conv.developer?.name ?? conv.developerName} ·{" "}
        <strong>Status:</strong> <span className="badge">{conv.status}</span>
      </p>

      <section style={{ margin: "1rem 0", padding: "0.75rem", background: "#f9fafb", borderRadius: "0.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Pattern mining</h2>
        <p>
          Latest job: {latestJob ? `${latestJob.status}${latestJob.tokenCost ? ` · ${latestJob.tokenCost} tokens` : ""}` : "none"} ·{" "}
          Proposed patterns awaiting review: <strong>{proposedCount}</strong>
        </p>
        <MineButton conversationId={conv.id} jobStatus={latestJob?.status} />
        {latestJob?.status === "failed" && <p style={{ color: "#b91c1c" }}>Last job failed: {latestJob.error}</p>}
      </section>

      <h2>Messages</h2>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {conv.parsedMessages.map((m, i) => (
          <div key={i} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem", background: m.role === "freelancer" ? "#eef2ff" : "#f3f4f6" }}>
            <strong>{m.author || "—"}</strong> <span className="badge">{m.role}</span>
            <pre style={{ whiteSpace: "pre-wrap", margin: "0.25rem 0 0", fontFamily: "inherit" }}>{m.content}</pre>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/conversations/[id]/MineButton.tsx src/app/conversations/[id]/page.tsx
git commit -m "feat(conversations): mine button + job status on detail page"
```

### Task 4.10: End-to-end verification (worker + mining)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all prior tests + mining (3) + dedupe (3) + claim (3) + mine handler (2) + enqueue API (2) PASS — with **no live OpenAI calls** (mining is mocked in tests).

- [ ] **Step 2: Set up a real `.env`**

Fill `.env` from `.env.example`: a working `DATABASE_URL` (Atlas or local replica set), `OPENAI_API_KEY`, a bcrypt `AUTH_PASSWORD_HASH`, and a 32+ char `SESSION_SECRET`.

- [ ] **Step 3: Push schema + seed (against the real DB)**

Run: `npm run db:push && npm run seed`
Expected: schema applied; "Seeded 17 categories and 6 exemplar standards."

- [ ] **Step 4: Start the worker (separate terminal)**

Run: `npm run worker`
Expected: `[worker] polling every 5000ms`.

- [ ] **Step 5: Start the web app, ingest, and mine**

Run: `npm run dev`
Then in the browser (signed in):
1. Ingest a real Upwork conversation on `/conversations`.
2. On its detail page, click **⛏ Mine for patterns**.
3. Within a few seconds (watch the worker terminal), the job flips to `done` with a token cost, and "Proposed patterns awaiting review" becomes ≥ 1.
4. Refresh to confirm; the conversation status is now `analyzed`.

- [ ] **Step 6: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: phase 1 chunk 4 verified end-to-end"
```

### Chunk 4 verification

- [ ] `npm test` → all unit/integration tests pass with OpenAI mocked
- [ ] Worker claims jobs atomically and requeues stale ones
- [ ] Mining produces evidence-backed `proposed` Patterns and records token cost
- [ ] De-duplication filters patterns matching existing standards
- [ ] End-to-end: ingest → mine → proposed patterns appear (real OpenAI)

---

## Chunk 5: Pattern review queue + approval → Standard (+ standard editing)

**Outcome of this chunk:** a `/review` page lists every `proposed` Pattern with its evidence; the user Approves (creates a linked `Standard`), Rejects, or Merges into an existing Standard. Approved standards are then refineable (especially `howToCheck`) via an inline editor on the catalog detail page. This closes the Phase-1 discovery loop end-to-end: **Conversation → Pattern → human-approved Standard**. Nothing the AI produces becomes a Standard without a human click (spec §6.4).

### Task 5.1: Approve / reject / merge logic

**Files:**
- Create: `src/lib/patterns/approve.ts`
- Test: `tests/patterns/approve.test.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Write the failing test**

```ts
// tests/patterns/approve.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { approvePattern, rejectPattern, mergePattern } from "@/lib/patterns/approve";

let categoryId: string;
let patternId: string;

beforeEach(async () => {
  await prisma.pattern.deleteMany({});
  await prisma.standard.deleteMany({ where: { code: { startsWith: "STD-" } } });
  const cat = await prisma.category.findUnique({ where: { slug: "testing" } });
  if (!cat) throw new Error("seed missing Testing category");
  categoryId = cat.id;
  const conv = await prisma.conversation.create({
    data: { title: "T", developerName: "A", rawText: "A: tests should be isolated",
      parsedMessages: [{ role: "freelancer", author: "A", content: "tests should be isolated", timestamp: null }], status: "ingested" },
  });
  const p = await prisma.pattern.create({
    data: { fromConversationId: conv.id, description: "Tests must be independent of each other",
      severity: "major", suggestedStandardText: "Each test must not depend on another's side effects.",
      evidence: [{ quote: "A: tests should be isolated" }], status: "proposed" },
  });
  patternId = p.id;
});

it("approvePattern creates an approved mined standard and links the pattern", async () => {
  const { code, standardId } = await approvePattern(patternId, categoryId);
  expect(code).toBe("STD-001");
  const std = await prisma.standard.findUnique({ where: { id: standardId } });
  expect(std?.source).toBe("mined");
  expect(std?.status).toBe("approved");
  expect(std?.categoryId).toBe(categoryId);
  expect(std?.sourceConversationId).toBeTruthy();
  const pat = await prisma.pattern.findUnique({ where: { id: patternId } });
  expect(pat?.status).toBe("approved-as-standard");
  expect(pat?.linkedStandardId).toBe(standardId);
});

it("approvePattern refuses a pattern that is no longer proposed", async () => {
  await rejectPattern(patternId);
  await expect(approvePattern(patternId, categoryId)).rejects.toThrow();
});

it("rejectPattern marks the pattern rejected", async () => {
  await rejectPattern(patternId);
  const pat = await prisma.pattern.findUnique({ where: { id: patternId } });
  expect(pat?.status).toBe("rejected");
});

it("mergePattern links the pattern to an existing standard", async () => {
  const std = await prisma.standard.create({ data: { code: "STD-900", title: "Existing", description: "d", howToCheck: "c", appliesTo: ["all"] } });
  await mergePattern(patternId, std.id);
  const pat = await prisma.pattern.findUnique({ where: { id: patternId } });
  expect(pat?.status).toBe("merged");
  expect(pat?.linkedStandardId).toBe(std.id);
});

it("rejectPattern and mergePattern refuse a non-proposed pattern", async () => {
  await approvePattern(patternId, categoryId); // flips to approved-as-standard
  await expect(rejectPattern(patternId)).rejects.toThrow();
  await expect(mergePattern(patternId, patternId)).rejects.toThrow(); // guard fires before standard lookup
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/patterns/approve.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/patterns/approve.ts`**

```ts
import { prisma } from "@/lib/db";

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Mined standards get a simple global STD-NNN code (authored exemplars keep semantic codes like VC-001).
// Single-user sequential approves won't collide; the @unique(code) guard backstops any race.
async function nextStandardCode(): Promise<string> {
  const count = await prisma.standard.count({ where: { code: { startsWith: "STD-" } } });
  return `STD-${String(count + 1).padStart(3, "0")}`;
}

export async function approvePattern(patternId: string, categoryId: string): Promise<{ standardId: string; code: string }> {
  const pattern = await prisma.pattern.findUnique({ where: { id: patternId } });
  if (!pattern) throw new Error("Pattern not found");
  if (pattern.status !== "proposed") throw new Error(`Pattern is not proposed (status: ${pattern.status})`);

  const code = await nextStandardCode();
  const standard = await prisma.standard.create({
    data: {
      code,
      title: truncate(pattern.description, 80),
      description: pattern.suggestedStandardText ?? pattern.description,
      categoryId,
      severity: pattern.severity,
      status: "approved",
      howToCheck: "", // refine via the catalog editor after approval (Task 5.3)
      appliesTo: ["all"],
      source: "mined",
      sourceConversationId: pattern.fromConversationId,
    },
  });
  await prisma.pattern.update({
    where: { id: patternId },
    data: { status: "approved-as-standard", linkedStandardId: standard.id, reviewedAt: new Date() },
  });
  return { standardId: standard.id, code: standard.code };
}

export async function rejectPattern(patternId: string): Promise<void> {
  const pattern = await prisma.pattern.findUnique({ where: { id: patternId } });
  if (!pattern) throw new Error("Pattern not found");
  if (pattern.status !== "proposed") throw new Error(`Pattern is not proposed (status: ${pattern.status})`);
  await prisma.pattern.update({ where: { id: patternId }, data: { status: "rejected", reviewedAt: new Date() } });
}

export async function mergePattern(patternId: string, standardId: string): Promise<void> {
  const pattern = await prisma.pattern.findUnique({ where: { id: patternId } });
  if (!pattern) throw new Error("Pattern not found");
  if (pattern.status !== "proposed") throw new Error(`Pattern is not proposed (status: ${pattern.status})`);
  const standard = await prisma.standard.findUnique({ where: { id: standardId } });
  if (!standard) throw new Error("Standard not found");
  await prisma.pattern.update({
    where: { id: patternId },
    data: { status: "merged", linkedStandardId: standardId, reviewedAt: new Date() },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/patterns/approve.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/patterns/approve.ts tests/patterns/approve.test.ts
git commit -m "feat(patterns): add approve/reject/merge logic"
```

### Task 5.2: Patterns PATCH API

**Files:**
- Create: `src/app/api/patterns/[id]/route.ts`
- Test: `tests/api/patterns.test.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/patterns.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/patterns/[id]/route";
import { prisma } from "@/lib/db";

let patternId: string;
let categoryId: string;

beforeEach(async () => {
  await prisma.pattern.deleteMany({});
  await prisma.standard.deleteMany({ where: { code: { startsWith: "STD-" } } });
  const cat = await prisma.category.findUnique({ where: { slug: "testing" } });
  categoryId = cat!.id;
  const conv = await prisma.conversation.create({ data: { title: "T", developerName: "A", rawText: "x", parsedMessages: [], status: "ingested" } });
  patternId = (await prisma.pattern.create({ data: { fromConversationId: conv.id, description: "X", severity: "minor", evidence: [{ quote: "q" }], status: "proposed" } })).id;
});

function req(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/patterns/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

it("approves via PATCH and returns the new standard code", async () => {
  const res = await PATCH(req(patternId, { action: "approve", categoryId }), { params: Promise.resolve({ id: patternId }) });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.code).toBe("STD-001");
  expect(await prisma.standard.count({ where: { code: "STD-001" } })).toBe(1);
});

it("rejects via PATCH", async () => {
  const res = await PATCH(req(patternId, { action: "reject" }), { params: Promise.resolve({ id: patternId }) });
  expect(res.status).toBe(200);
  expect((await prisma.pattern.findUnique({ where: { id: patternId } }))?.status).toBe("rejected");
});

it("returns 400 when approve lacks categoryId", async () => {
  const res = await PATCH(req(patternId, { action: "approve" }), { params: Promise.resolve({ id: patternId }) });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/patterns.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/api/patterns/[id]/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { approvePattern, rejectPattern, mergePattern } from "@/lib/patterns/approve";

const Body = z.object({
  action: z.enum(["approve", "reject", "merge"]),
  categoryId: z.string().min(1).optional(),  // required for approve
  standardId: z.string().min(1).optional(),   // required for merge
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { action, categoryId, standardId } = parsed.data;

  try {
    if (action === "approve") {
      if (!categoryId) return NextResponse.json({ error: "categoryId required for approve" }, { status: 400 });
      const res = await approvePattern(id, categoryId);
      return NextResponse.json(res);
    }
    if (action === "reject") { await rejectPattern(id); return NextResponse.json({ ok: true }); }
    // merge
    if (!standardId) return NextResponse.json({ error: "standardId required for merge" }, { status: 400 });
    await mergePattern(id, standardId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/patterns.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/patterns/[id]/route.ts tests/api/patterns.test.ts
git commit -m "feat(api): add pattern approve/reject/merge endpoint"
```

### Task 5.3: Standard editing (so approved standards become enforceable)

**Files:**
- Create: `src/app/api/standards/[code]/route.ts`
- Create: `src/app/catalog/[code]/EditStandardForm.tsx`
- Modify: `src/app/catalog/[code]/page.tsx`
- Test: `tests/api/standards.test.ts`

@superpowers:test-driven-development

- [ ] **Step 1: Write the failing test**

```ts
// tests/api/standards.test.ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/standards/[code]/route";
import { prisma } from "@/lib/db";

function req(code: string, body: unknown) {
  return new NextRequest(`http://localhost/api/standards/${code}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("PATCH /api/standards/[code]", () => {
  it("updates fields and bumps version", async () => {
    const s = await prisma.standard.create({ data: { code: "EDIT-001", title: "T", description: "d", howToCheck: "c", appliesTo: ["all"] } });
    const res = await PATCH(req("EDIT-001", { howToCheck: "Updated check.", severity: "blocker" }), { params: Promise.resolve({ code: "EDIT-001" }) });
    expect(res.status).toBe(200);
    const after = await prisma.standard.findUnique({ where: { code: "EDIT-001" } });
    expect(after?.howToCheck).toBe("Updated check.");
    expect(after?.severity).toBe("blocker");
    expect(after?.version).toBe(s.version + 1);
  });

  it("returns 404 for an unknown code", async () => {
    const res = await PATCH(req("NOPE-999", { description: "x" }), { params: Promise.resolve({ code: "NOPE-999" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/standards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/api/standards/[code]/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const Body = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  howToCheck: z.string().optional(),
  severity: z.enum(["blocker", "major", "minor"]).optional(),
  status: z.enum(["draft", "approved", "deprecated"]).optional(),
  appliesTo: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.standard.findUnique({ where: { code } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Simple versioning: bump version on each edit. Full revision history (diffs) is a later phase.
  await prisma.standard.update({
    where: { code },
    data: { ...parsed.data, version: { increment: 1 } },
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/standards.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create `src/app/catalog/[code]/EditStandardForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditStandardForm({ code, initial }: {
  code: string;
  initial: { title: string; description: string; howToCheck: string; severity: string; status: string; appliesTo: string };
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const appliesTo = f.appliesTo.split(",").map((s) => s.trim()).filter(Boolean);
    const res = await fetch(`/api/standards/${code}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, appliesTo }),
    });
    setBusy(false);
    setMsg(res.ok ? "Saved." : "Failed to save.");
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={save} style={{ display: "grid", gap: "0.5rem", maxWidth: "48rem", marginTop: "1rem" }}>
      <label>Title <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label>Description <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} /></label>
      <label>How to check <textarea value={f.howToCheck} onChange={(e) => setF({ ...f, howToCheck: e.target.value })} rows={3} /></label>
      <label>Severity
        <select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>
          <option>blocker</option><option>major</option><option>minor</option>
        </select>
      </label>
      <label>Status
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option>draft</option><option>approved</option><option>deprecated</option>
        </select>
      </label>
      <label>Applies to (comma-separated stacks) <input value={f.appliesTo} onChange={(e) => setF({ ...f, appliesTo: e.target.value })} /></label>
      <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      {msg && <p>{msg}</p>}
    </form>
  );
}
```

- [ ] **Step 6: Modify `src/app/catalog/[code]/page.tsx` to add the editor**

Import `EditStandardForm` from `./EditStandardForm`, and render it at the bottom of the page (after the existing read-only detail), passing the current values:

```tsx
<EditStandardForm
  code={standard.code}
  initial={{
    title: standard.title,
    description: standard.description,
    howToCheck: standard.howToCheck,
    severity: standard.severity,
    status: standard.status,
    appliesTo: standard.appliesTo.join(", "),
  }}
/>
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/standards/[code]/route.ts src/app/catalog/[code]/EditStandardForm.tsx src/app/catalog/[code]/page.tsx tests/api/standards.test.ts
git commit -m "feat(catalog): inline standard editing with version bump"
```

### Task 5.4: Review queue page

**Files:**
- Create: `src/app/review/ReviewActions.tsx`
- Create: `src/app/review/page.tsx`

- [ ] **Step 1: Create `src/app/review/ReviewActions.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewActions({ patternId, categories, standards, suggestedCategory }: {
  patternId: string;
  categories: { id: string; name: string }[];
  standards: { id: string; code: string; title: string }[];
  suggestedCategory: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const defaultCat = categories.find((c) => c.name.toLowerCase() === (suggestedCategory ?? "").toLowerCase())?.id ?? categories[0]?.id ?? "";
  const [categoryId, setCategoryId] = useState(defaultCat);
  const [standardId, setStandardId] = useState(standards[0]?.id ?? "");

  async function act(action: "approve" | "reject" | "merge", extra: Record<string, string> = {}) {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/patterns/${patternId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    if (!res.ok) { setErr(((await res.json()) as { error?: string }).error ?? "Failed"); return; }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={busy}>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button disabled={busy || !categoryId} onClick={() => act("approve", { categoryId })}>✓ Approve as standard</button>
      <button disabled={busy} onClick={() => act("reject")}>✗ Reject</button>
      <span style={{ color: "#888" }}>or merge into</span>
      <select value={standardId} onChange={(e) => setStandardId(e.target.value)} disabled={busy}>
        {standards.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.title}</option>)}
      </select>
      <button disabled={busy || !standardId} onClick={() => act("merge", { standardId })}>Merge</button>
      {err && <span style={{ color: "#b91c1c" }}>{err}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/review/page.tsx`**

```tsx
import { prisma } from "@/lib/db";
import { ReviewActions } from "./ReviewActions";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const [patterns, categories, standards] = await Promise.all([
    prisma.pattern.findMany({ where: { status: "proposed" }, orderBy: { createdAt: "desc" } }),
    prisma.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
    prisma.standard.findMany({ where: { status: "approved" }, select: { id: true, code: true, title: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <>
      <h1>Review queue</h1>
      <p>{patterns.length} proposed pattern(s) awaiting your decision.</p>
      {patterns.length === 0 ? (
        <p style={{ color: "#aaa" }}><em>Nothing to review. Mine a conversation to generate patterns.</em></p>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {patterns.map((p) => (
            <div key={p.id} style={{ border: "1px solid #8884", borderRadius: "0.5rem", padding: "0.75rem" }}>
              <p>
                <strong>{p.description}</strong>{" "}
                <span className={`sev-${p.severity}`}>{p.severity}</span>
                {p.suggestedCategory ? <> · <em>cat: {p.suggestedCategory}</em></> : null}
              </p>
              {p.suggestedStandardText && <p>{p.suggestedStandardText}</p>}
              <ul>{p.evidence.map((e, i) => <li key={i} style={{ fontStyle: "italic" }}>“{e.quote}”</li>)}</ul>
              <ReviewActions patternId={p.id} categories={categories} standards={standards} suggestedCategory={p.suggestedCategory} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/review/
git commit -m "feat(review): pattern review queue with approve/reject/merge"
```

### Task 5.5: Nav link + Phase 1 end-to-end verification

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add a Review link to the nav**

In `src/app/layout.tsx`, add `<a href="/review">Review</a>` next to Catalog/Conversations inside `<nav>`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: every test across all five chunks passes — env, seed, password, jwt, parser, ingest API, mining (mocked), dedupe, claim, stale, mine handler (mocked), enqueue API, approve, patterns API, standards API. **No live OpenAI calls.**

- [ ] **Step 3: Phase 1 end-to-end verification (real OpenAI, two terminals)**

With `.env` filled and the DB seeded, run `npm run worker` in one terminal and `npm run dev` in another, then in the browser (signed in):
1. Ingest a real Upwork conversation on `/conversations`.
2. On its detail page, click **⛏ Mine for patterns**; wait for the job to flip to `done`.
3. Go to `/review`; the proposed patterns appear with evidence quotes.
4. **Approve** one (pick a category) → it disappears from the queue and a new `STD-NNN` standard appears in `/catalog` under that category.
5. Open that standard on `/catalog/<code>`, fill in **How to check**, and save (version increments).
6. **Reject** another pattern → it leaves the queue. **Merge** a third into an existing standard → it leaves the queue.
7. Re-mine the same conversation → the review queue shows only net-new patterns (dedupe working).

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(nav): link to review queue"
```

### Chunk 5 verification

- [ ] `npm test` → all Phase-1 tests pass (OpenAI mocked)
- [ ] `/review` lists proposed patterns with evidence
- [ ] Approve creates a linked `STD-NNN` Standard; Reject and Merge resolve the pattern
- [ ] Standards are editable inline (howToCheck etc.) with a version bump
- [ ] End-to-end: ingest → mine → review → approve → enforceable standard in the catalog

---

## Phase 1 complete

Phase 1 delivers the full discovery loop: **paste a conversation → AI mines evidence-backed patterns → you approve them into enforceable standards**, all behind a single-user login, deployable to managed cloud and embedded in the Google Sites intranet.

### Deferred to later phases (do NOT build in Phase 1)
- **Bounded automatic retry** of failed mining jobs (Phase 1 preserves the error + input for one-click re-enqueue via the Mine button).
- **Full revision history** per standard (Phase 1 bumps `version`; diff history is later).
- **Compliance grading, stack detection, scorecards, developer identity merge** — these are Phase 2/3, each with their own spec + plan.
- **Embedding-based semantic dedupe** (Phase 1 uses token-overlap).

### Phase 2 & 3 pointers
- Phase 2 builds the grading pipeline (`Evaluation` against applicable `Standard`s), stack detection, and the low-confidence review queue.
- Phase 3 adds developer identity merge, scorecard rollups, and the overview dashboard.

