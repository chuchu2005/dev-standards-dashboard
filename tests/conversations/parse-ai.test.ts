import { describe, it, expect, vi, beforeEach } from "vitest";

// Mirror tests/openai/mining.test.ts: hoist the mock fn so the (hoisted) factory can close over it.
const { parseMock } = vi.hoisted(() => ({ parseMock: vi.fn() }));
vi.mock("@/lib/openai/client", () => ({
  openai: { beta: { chat: { completions: { parse: parseMock } } } },
}));

import { parseConversationWithAI } from "@/lib/conversations/parse-ai";

beforeEach(() => parseMock.mockReset());

describe("parseConversationWithAI", () => {
  it("maps structured output to ParsedMessage[] with roles", async () => {
    parseMock.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              messages: [
                { author: "Alice", role: "client", content: "Can you build it?" },
                { author: "Bob", role: "freelancer", content: "Sure, I'll start today." },
              ],
            },
          },
        },
      ],
    });
    const out = await parseConversationWithAI("Alice: Can you build it?\nBob: Sure, I'll start today.", "Bob");
    expect(out).toEqual([
      { role: "client", author: "Alice", content: "Can you build it?", timestamp: null },
      { role: "freelancer", author: "Bob", content: "Sure, I'll start today.", timestamp: null },
    ]);
  });

  it("rejects when the OpenAI response is unusable (so the caller falls back)", async () => {
    // Vitest flags errors that originate inside a vi.mock'd function as unhandled,
    // even when caught. So exercise the failure path via a REAL-code throw:
    // no `choices` → TypeError when parseConversationWithAI reads completion.choices[0].
    parseMock.mockResolvedValue({});
    await expect(parseConversationWithAI("Alice: hi", "Bob")).rejects.toThrow();
  });

  it("throws when the model returns 0 messages for non-empty input (so the caller falls back)", async () => {
    parseMock.mockResolvedValue({ choices: [{ message: { parsed: { messages: [] } } }] });
    await expect(parseConversationWithAI("Alice: hi", "Bob")).rejects.toThrow();
  });

  it("passes the developerName into the system prompt", async () => {
    parseMock.mockResolvedValue({
      choices: [
        { message: { parsed: { messages: [{ author: "Bob", role: "freelancer", content: "ok" }] } } },
      ],
    });
    await parseConversationWithAI("Bob: ok", "Bob");
    const call = parseMock.mock.calls[0][0];
    const sys = call.messages.find((m: { role: string }) => m.role === "system").content;
    expect(sys).toContain("Bob");
    expect(sys).toContain("CLIENT");
    expect(sys).toContain("FREELANCER");
  });
});
