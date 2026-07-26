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
