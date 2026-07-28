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
