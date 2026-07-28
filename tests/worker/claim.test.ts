import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { claimNextJob } from "@/worker/claim";

async function seedJobs(n: number) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const j = await prisma.job.create({ data: { type: "mine-patterns", status: "queued" } });
    ids.push(j.id);
  }
  return ids;
}

describe("claimNextJob", () => {
  beforeEach(async () => { await prisma.job.deleteMany({}); });

  it("claims the oldest queued job and marks it running", async () => {
    const [first] = await seedJobs(2);
    const job = await claimNextJob();
    expect(job?.id).toBe(first);
    const updated = await prisma.job.findUnique({ where: { id: first } });
    expect(updated?.status).toBe("running");
    expect(updated?.startedAt).not.toBeNull();
  });

  it("returns null when nothing is queued", async () => {
    expect(await claimNextJob()).toBeNull();
  });

  it("skips a running job and claims the queued one", async () => {
    const running = await prisma.job.create({ data: { type: "mine-patterns", status: "running", startedAt: new Date() } });
    const [queued] = await seedJobs(1);
    const claimed = await claimNextJob();
    expect(claimed?.id).toBe(queued);
    expect(claimed?.id).not.toBe(running.id);
  });
});
