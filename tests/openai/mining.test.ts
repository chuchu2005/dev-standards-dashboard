import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above imports, so the factory can't close over a top-level const.
// vi.hoisted lifts the mock fn so it exists when the (hoisted) factory runs.
const { parseMock } = vi.hoisted(() => ({ parseMock: vi.fn() }));
vi.mock("@/lib/openai/client", () => ({
  openai: { beta: { chat: { completions: { parse: parseMock } } } },
}));

import { minePatterns } from "@/lib/openai/mining";

const SAMPLE = {
  description: "Functions include JSDoc parameter annotations",
  suggestedCategory: "Documentation",
  severity: "minor" as const,
  occurrences: 3,
  suggestedStandardText: "Document all function parameters.",
  evidence: [{ quote: "Alice: I always annotate params with JSDoc" }],
};

beforeEach(() => parseMock.mockReset());

it("returns parsed patterns and token usage", async () => {
  parseMock.mockResolvedValue({
    choices: [{ message: { parsed: { patterns: [SAMPLE] } } }],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
  });
  const out = await minePatterns({
    messages: [{ author: "Alice", content: "I always annotate params with JSDoc" }],
    existingStandardCodes: [],
    existingPatternDescriptions: [],
    categoryNames: ["Documentation"],
  });
  expect(out.patterns).toHaveLength(1);
  expect(out.patterns[0].evidence[0].quote).toContain("JSDoc");
  expect(out.usage.totalTokens).toBe(120);
});

it("returns an empty pattern list when the model returns none", async () => {
  parseMock.mockResolvedValue({ choices: [{ message: { parsed: { patterns: [] } } }], usage: { total_tokens: 5, prompt_tokens: 5, completion_tokens: 0 } });
  const out = await minePatterns({ messages: [], existingStandardCodes: [], existingPatternDescriptions: [], categoryNames: [] });
  expect(out.patterns).toEqual([]);
});

it("passes existing standard codes and category names into the prompt", async () => {
  parseMock.mockResolvedValue({ choices: [{ message: { parsed: { patterns: [] } } }], usage: { total_tokens: 1, prompt_tokens: 1, completion_tokens: 0 } });
  await minePatterns({ messages: [{ author: "A", content: "x" }], existingStandardCodes: ["VC-001"], existingPatternDescriptions: [], categoryNames: ["Testing"] });
  const call = parseMock.mock.calls[0][0];
  const userContent = call.messages.find((m: { role: string }) => m.role === "user").content;
  expect(userContent).toContain("VC-001");
  expect(userContent).toContain("Testing");
});
