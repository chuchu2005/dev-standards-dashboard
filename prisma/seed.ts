// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Cat = { slug: string; name: string; description: string; order: number };

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

async function main() {
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name, description: c.description, order: c.order },
    });
  }
  console.log(`Seeded ${categories.length} categories.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
