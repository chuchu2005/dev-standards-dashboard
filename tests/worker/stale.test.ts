import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { requeueStaleJobs, STALE_MS } from "@/worker/stale";

describe("requeueStaleJobs", () => {
  beforeEach(async () => { await prisma.job.deleteMany({}); });

  it("requeues a running job older than the stale window", async () => {
    const old = new Date(Date.now() - STALE_MS - 60_000);
    await prisma.job.create({ data: { type: "mine-patterns", status: "running", startedAt: old } });
    const count = await requeueStaleJobs();
    expect(count).toBe(1);
    const jobs = await prisma.job.findMany();
    expect(jobs[0].status).toBe("queued");
  });

  it("leaves a recently-started running job alone", async () => {
    await prisma.job.create({ data: { type: "mine-patterns", status: "running", startedAt: new Date() } });
    expect(await requeueStaleJobs()).toBe(0);
  });
});
