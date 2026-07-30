// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Cat = { slug: string; name: string; description: string; order: number };

// Engagement-lens taxonomy (see docs/superpowers/specs/2026-07-30-engagement-rescope-design.md).
// Conversations being ingested are codeless Upwork client↔freelancer chats, so the
// catalog evaluates the freelancer's *engagement*, not code quality.
const categories: Cat[] = [
  { slug: "reliability-delivery", name: "Reliability & Delivery", order: 1, description: "Deadlines met or missed, ghosting, overpromising, availability, owning & reporting failures." },
  { slug: "scope-requirements", name: "Scope & Requirements", order: 2, description: "Understanding the brief, scope creep, rework, missed or changed requirements." },
  { slug: "communication-professionalism", name: "Communication & Professionalism", order: 3, description: "Clarity, responsiveness, tone, proactive updates, conduct." },
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
