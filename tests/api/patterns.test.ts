import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/patterns/[id]/route";
import { prisma } from "@/lib/db";

let patternId: string;
let categoryId: string;

beforeEach(async () => {
  // Scope cleanup to patterns this file creates (by description) so we don't
  // race with parallel test files that rely on patterns they just created
  // (e.g. tests/worker/handlers/mine.test.ts).
  await prisma.pattern.deleteMany({ where: { description: "X" } });
  await prisma.standard.deleteMany({ where: { code: { startsWith: "STD-" } } });
  const cat = await prisma.category.findUnique({ where: { slug: "testing" } });
  categoryId = cat!.id;
  const conv = await prisma.conversation.create({ data: { title: "T", developerName: "A", rawText: "x", parsedMessages: [], status: "ingested" } });
  patternId = (await prisma.pattern.create({ data: { fromConversationId: conv.id, description: "X", severity: "minor", evidence: [{ quote: "q" }], status: "proposed" } })).id;
});

function req(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/patterns/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

it("approves via PATCH and returns the new standard code", async () => {
  const res = await PATCH(req(patternId, { action: "approve", categoryId }), { params: Promise.resolve({ id: patternId }) });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.code).toBe("STD-001");
  expect(await prisma.standard.count({ where: { code: "STD-001" } })).toBe(1);
});

it("rejects via PATCH", async () => {
  const res = await PATCH(req(patternId, { action: "reject" }), { params: Promise.resolve({ id: patternId }) });
  expect(res.status).toBe(200);
  expect((await prisma.pattern.findUnique({ where: { id: patternId } }))?.status).toBe("rejected");
});

it("returns 400 when approve lacks categoryId", async () => {
  const res = await PATCH(req(patternId, { action: "approve" }), { params: Promise.resolve({ id: patternId }) });
  expect(res.status).toBe(400);
});
