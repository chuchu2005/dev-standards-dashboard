import { prisma } from "@/lib/db";

export async function claimNextJob() {
  const next = await prisma.job.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!next) return null;
  // Compare-and-swap: only transitions queued → running. If another worker won the race, count is 0.
  const res = await prisma.job.updateMany({
    where: { id: next.id, status: "queued" },
    data: { status: "running", startedAt: new Date() },
  });
  return res.count === 1 ? next : null;
}
