import type { PrismaClient } from "@prisma/client";

interface CategoryInput {
  slug: string;
  name: string;
  description: string;
  order: number;
}

// Engagement-lens taxonomy. Conversations ingested are codeless Upwork client↔freelancer
// chats, so the catalog evaluates the freelancer's *engagement*, not code quality.
// See docs/superpowers/specs/2026-07-30-engagement-rescope-design.md.
const ENGAGEMENT_CATEGORIES: CategoryInput[] = [
  { slug: "reliability-delivery", name: "Reliability & Delivery", order: 1, description: "Deadlines met or missed, ghosting, overpromising, availability, owning & reporting failures." },
  { slug: "scope-requirements", name: "Scope & Requirements", order: 2, description: "Understanding the brief, scope creep, rework, missed or changed requirements." },
  { slug: "communication-professionalism", name: "Communication & Professionalism", order: 3, description: "Clarity, responsiveness, tone, proactive updates, conduct." },
];

const STD_001_TARGET_SLUG = "reliability-delivery";

export interface MigrationResult {
  categoriesUpserted: number;
  std001Rehomed: boolean;
  oldCategoriesDeleted: number;
  oldCategoriesKept: number;
}

/**
 * One-time, idempotent migration from the code-quality taxonomy to the engagement
 * taxonomy. Run via `npx tsx prisma/migrate-to-engagement.ts`.
 *
 * 1. Upsert the 3 engagement categories.
 * 2. Guarded re-home of STD-001 (a runtime-approved record via approve.ts, NOT seed
 *    data — so it may be absent on a fresh DB; the re-home is a no-op then).
 * 3. Delete the old code categories that now hold no standards; warn (don't drop) any
 *    that still hold a standard so a mixed catalog is visible, not silently kept.
 */
export async function migrateToEngagement(
  prisma: PrismaClient,
  log: (msg: string) => void = console.log,
): Promise<MigrationResult> {
  for (const c of ENGAGEMENT_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name, description: c.description, order: c.order },
    });
  }

  let std001Rehomed = false;
  const target = await prisma.category.findUnique({ where: { slug: STD_001_TARGET_SLUG } });
  if (!target) {
    log(`WARNING: target category "${STD_001_TARGET_SLUG}" not found; skipping STD-001 re-home.`);
  } else {
    const std001 = await prisma.standard.findUnique({ where: { code: "STD-001" } });
    if (std001) {
      await prisma.standard.update({ where: { id: std001.id }, data: { categoryId: target.id } });
      std001Rehomed = true;
      log(`Re-homed STD-001 → "${target.name}".`);
    } else {
      log("STD-001 not present; skipping re-home (no-op).");
    }
  }

  const engagementSlugs = new Set(ENGAGEMENT_CATEGORIES.map((c) => c.slug));
  const all = await prisma.category.findMany({ include: { standards: { select: { id: true } } } });
  let oldCategoriesDeleted = 0;
  let oldCategoriesKept = 0;
  for (const c of all) {
    if (engagementSlugs.has(c.slug)) continue;
    if (c.standards.length === 0) {
      await prisma.category.delete({ where: { id: c.id } });
      oldCategoriesDeleted++;
    } else {
      oldCategoriesKept++;
      log(`WARNING: kept old category "${c.name}" — still holds ${c.standards.length} standard(s); re-home or remove it manually.`);
    }
  }

  return { categoriesUpserted: ENGAGEMENT_CATEGORIES.length, std001Rehomed, oldCategoriesDeleted, oldCategoriesKept };
}
