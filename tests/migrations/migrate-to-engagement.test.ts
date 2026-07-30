import { describe, it, expect } from "vitest";
import { migrateToEngagement } from "@/lib/migrations/migrate-to-engagement";
import type { PrismaClient } from "@prisma/client";

interface FakeCat { id: string; slug: string; name: string; description: string; order: number }
interface FakeStd { id: string; code: string; categoryId: string | null }

// Minimal in-memory Prisma-like client covering the surface the migration uses.
function makeFake(initial: { categories?: FakeCat[]; standards?: FakeStd[] } = {}) {
  const categories: FakeCat[] = [...(initial.categories ?? [])];
  const standards: FakeStd[] = [...(initial.standards ?? [])];
  const logs: string[] = [];
  const prisma = {
    category: {
      upsert: async ({ where, create, update }: { where: { slug: string }; create: FakeCat; update: Partial<FakeCat> }) => {
        const idx = categories.findIndex((c) => c.slug === where.slug);
        if (idx === -1) categories.push({ ...create, id: create.id ?? where.slug });
        else categories[idx] = { ...categories[idx], ...update };
      },
      findUnique: async ({ where }: { where: { slug: string } }) =>
        categories.find((c) => c.slug === where.slug) ?? null,
      findMany: async () =>
        categories.map((c) => ({
          ...c,
          standards: standards.filter((s) => s.categoryId === c.id).map((s) => ({ id: s.id })),
        })),
      delete: async ({ where }: { where: { id: string } }) => {
        const idx = categories.findIndex((c) => c.id === where.id);
        if (idx !== -1) categories.splice(idx, 1);
      },
    },
    standard: {
      findUnique: async ({ where }: { where: { code: string } }) =>
        standards.find((s) => s.code === where.code) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { categoryId: string } }) => {
        const s = standards.find((x) => x.id === where.id);
        if (s) Object.assign(s, data);
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, logs, log: (m: string) => logs.push(m) };
}

describe("migrateToEngagement", () => {
  it("upserts the 3 engagement categories", async () => {
    const { prisma } = makeFake();
    await migrateToEngagement(prisma);
    const cats = await (prisma as any).category.findMany();
    expect(cats.map((c: FakeCat) => c.slug).sort()).toEqual([
      "communication-professionalism",
      "reliability-delivery",
      "scope-requirements",
    ]);
  });

  it("re-homes STD-001 into Reliability & Delivery and drops its old empty category", async () => {
    const { prisma } = makeFake({
      categories: [{ id: "cat-eh", slug: "error-handling", name: "Error Handling", description: "x", order: 7 }],
      standards: [{ id: "std-1", code: "STD-001", categoryId: "cat-eh" }],
    });
    const res = await migrateToEngagement(prisma);
    expect(res.std001Rehomed).toBe(true);
    const std = await (prisma as any).standard.findUnique({ where: { code: "STD-001" } });
    expect(std?.categoryId).toBe("reliability-delivery");
    const cats = await (prisma as any).category.findMany();
    expect(cats.find((c: FakeCat) => c.slug === "error-handling")).toBeUndefined();
  });

  it("is a safe no-op for STD-001 when it is absent (fresh DB)", async () => {
    const { prisma } = makeFake();
    const res = await migrateToEngagement(prisma);
    expect(res.std001Rehomed).toBe(false);
  });

  it("deletes empty old categories but keeps non-empty ones with a warning", async () => {
    const { prisma, logs, log } = makeFake({
      categories: [
        { id: "cat-empty", slug: "testing", name: "Testing", description: "x", order: 6 },
        { id: "cat-orphan", slug: "security", name: "Security", description: "x", order: 8 },
      ],
      standards: [{ id: "std-x", code: "SEC-001", categoryId: "cat-orphan" }],
    });
    const res = await migrateToEngagement(prisma, log);
    expect(res.oldCategoriesDeleted).toBe(1); // testing
    expect(res.oldCategoriesKept).toBe(1);    // security still holds SEC-001
    expect(logs.some((l) => /WARNING/.test(l) && /Security/.test(l))).toBe(true);
    const cats = await (prisma as any).category.findMany();
    expect(cats.find((c: FakeCat) => c.slug === "testing")).toBeUndefined();
    expect(cats.find((c: FakeCat) => c.slug === "security")).toBeDefined();
  });

  it("is idempotent (running twice yields the same state)", async () => {
    const { prisma } = makeFake({
      categories: [{ id: "cat-eh", slug: "error-handling", name: "Error Handling", description: "x", order: 7 }],
      standards: [{ id: "std-1", code: "STD-001", categoryId: "cat-eh" }],
    });
    await migrateToEngagement(prisma);
    const res2 = await migrateToEngagement(prisma);
    const cats = await (prisma as any).category.findMany();
    expect(cats).toHaveLength(3);
    expect(res2.oldCategoriesDeleted).toBe(0);
    const std = await (prisma as any).standard.findUnique({ where: { code: "STD-001" } });
    expect(std?.categoryId).toBe("reliability-delivery");
  });
});
