// tests/api/conversations.test.ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/conversations/route";
import { prisma } from "@/lib/db";

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/api/conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/conversations", () => {
  it("creates a conversation with parsed messages and a developer", async () => {
    const res = await POST(jsonReq({ title: "Chat 1", developerName: "Alice", rawText: "Alice: hello\nBob: hi" }));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const conv = await prisma.conversation.findUnique({ where: { id } });
    expect(conv?.parsedMessages).toHaveLength(2);
    expect(conv?.status).toBe("ingested");
    expect(await prisma.developer.findFirst({ where: { name: "Alice" } })).not.toBeNull();
  });

  it("reuses an existing developer with the same exact name (no duplicate)", async () => {
    // Isolate from other tests so this case is order-independent.
    await prisma.developer.deleteMany({ where: { name: "Alice" } });
    await prisma.developer.create({ data: { name: "Alice" } });
    const before = await prisma.developer.count({ where: { name: "Alice" } });
    await POST(jsonReq({ title: "Chat 2", developerName: "Alice", rawText: "Alice: yo" }));
    const after = await prisma.developer.count({ where: { name: "Alice" } });
    expect(after).toBe(before); // reused, not duplicated
  });

  it("rejects invalid input with 400", async () => {
    const res = await POST(jsonReq({ title: "" }));
    expect(res.status).toBe(400);
  });
});
