import "dotenv/config";
import { prisma } from "@/lib/db";
import { claimNextJob } from "@/worker/claim";
import { requeueStaleJobs } from "@/worker/stale";
import { runMineJob } from "@/worker/handlers/mine";

const POLL_MS = 5000;

async function tick() {
  await requeueStaleJobs();
  const job = await claimNextJob();
  if (!job) return;
  if (job.type === "mine-patterns") {
    await runMineJob(job.id);
  } else {
    // grade jobs are Phase 2
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "failed", error: `Unsupported job type: ${job.type}`, finishedAt: new Date() },
    });
  }
}

async function main() {
  console.log(`[worker] polling every ${POLL_MS}ms`);
  while (true) {
    try { await tick(); } catch (e) { console.error("[worker] tick error:", e); }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
