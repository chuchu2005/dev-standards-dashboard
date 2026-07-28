import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";

describe("seed", () => {
  it("has all 17 categories", async () => {
    const count = await prisma.category.count();
    expect(count).toBe(17);
  });
});
