import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/conversations/[id]/mine/route";
import { prisma } from "@/lib/db";

function req(id: string) {
  return new NextRequest(`http://localhost/api/conversations/${id}/mine`, { method: "POST" });
}

describe("POST /api/conversations/[id]/mine", () => {
  it("enqueues a queued mine-patterns job (202)", async () => {
    const conv = await prisma.conversation.create({ data: { title: "T", developerName: "A", rawText: "A: hi", parsedMessages: [], status: "ingested" } });
    const res = await POST(req(conv.id), { params: Promise.resolve({ id: conv.id }) });
    expect(res.status).toBe(202);
    const { jobId } = await res.json();
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    expect(job?.type).toBe("mine-patterns");
    expect(job?.status).toBe("queued");
  });

  it("returns 404 for a missing conversation", async () => {
    const res = await POST(req("000000000000000000000000"), { params: Promise.resolve({ id: "000000000000000000000000" }) });
    expect(res.status).toBe(404);
  });
});
