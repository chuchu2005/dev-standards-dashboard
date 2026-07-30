import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";

describe("seed", () => {
  it("seeds the 3 engagement categories", async () => {
    const slugs = (await prisma.category.findMany({ select: { slug: true } })).map((c) => c.slug);
    expect(slugs.sort()).toEqual([
      "communication-professionalism",
      "reliability-delivery",
      "scope-requirements",
    ]);
  });
});
