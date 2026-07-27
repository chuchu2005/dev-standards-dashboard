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
