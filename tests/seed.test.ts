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
