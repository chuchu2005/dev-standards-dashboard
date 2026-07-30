// tests/api/conversations.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the OpenAI client (not parse-ai) so the REAL parseConversationWithAI runs.
// Vitest flags errors that originate inside a vi.mock'd function as unhandled even
// when caught, so failure paths are driven by real-code throws, not mock throws.
const { parseMock } = vi.hoisted(() => ({ parseMock: vi.fn() }));
vi.mock("@/lib/openai/client", () => ({
  openai: { beta: { chat: { completions: { parse: parseMock } } } },
}));

import { POST } from "@/app/api/conversations/route";
import { prisma } from "@/lib/db";

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/api/conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Shape openai...parse() returns and parseConversationWithAI unwraps.
function aiMessages(messages: { role: string; author: string; content: string }[]) {
  return { choices: [{ message: { parsed: { messages } } }] };
}

const TWO_MSGS = [
  { role: "client", author: "Alice", content: "hello" },
  { role: "freelancer", author: "Bob", content: "hi" },
];

describe("POST /api/conversations", () => {
  beforeEach(() => parseMock.mockReset());

  it("creates a conversation with parsed messages and a developer (AI parse path)", async () => {
    parseMock.mockResolvedValue(aiMessages(TWO_MSGS));
    const res = await POST(jsonReq({ title: "Chat 1", developerName: "Alice", rawText: "Alice: hello\nBob: hi" }));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const conv = await prisma.conversation.findUnique({ where: { id } });
    expect(conv?.parsedMessages).toHaveLength(2);
    expect(conv?.status).toBe("ingested");
    expect(await prisma.developer.findFirst({ where: { name: "Alice" } })).not.toBeNull();
  });

  it("reuses an existing developer with the same exact name (no duplicate)", async () => {
    parseMock.mockResolvedValue(aiMessages([{ role: "freelancer", author: "Alice", content: "yo" }]));
    // Isolate from other tests so this case is order-independent.
    await prisma.developer.deleteMany({ where: { name: "Alice" } });
    await prisma.developer.create({ data: { name: "Alice" } });
    const before = await prisma.developer.count({ where: { name: "Alice" } });
    await POST(jsonReq({ title: "Chat 2", developerName: "Alice", rawText: "Alice: yo" }));
    const after = await prisma.developer.count({ where: { name: "Alice" } });
    expect(after).toBe(before); // reused, not duplicated
  });

  it("falls back to the heuristic parser if the AI parse returns nothing usable", async () => {
    // Empty messages for non-empty input makes the REAL parseConversationWithAI throw,
    // which the route catches → heuristic fallback (no mock-originated error).
    parseMock.mockResolvedValue(aiMessages([]));
    const res = await POST(jsonReq({ title: "Fallback", developerName: "Alice", rawText: "Alice: hello\nBob: hi" }));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const conv = await prisma.conversation.findUnique({ where: { id } });
    expect((conv?.parsedMessages.length ?? 0)).toBeGreaterThan(0); // heuristic still parsed it
  });

  it("rejects invalid input with 400", async () => {
    const res = await POST(jsonReq({ title: "" }));
    expect(res.status).toBe(400);
  });
});
