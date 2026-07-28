import { prisma } from "@/lib/db";

export const STALE_MS = 5 * 60 * 1000;

export async function requeueStaleJobs(now: number = Date.now()): Promise<number> {
  const cutoff = new Date(now - STALE_MS);
  const res = await prisma.job.updateMany({
    where: { status: "running", startedAt: { lt: cutoff } },
    data: { status: "queued", startedAt: null },
  });
  return res.count;
}
