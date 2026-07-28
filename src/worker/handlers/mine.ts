import { prisma } from "@/lib/db";
import { minePatterns } from "@/lib/openai/mining";
import { dedupeProposed } from "@/lib/patterns/dedupe";

async function failJob(jobId: string, error: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "failed", error, finishedAt: new Date() },
  });
}

export async function runMineJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.type !== "mine-patterns" || !job.targetId) {
    await failJob(jobId, "Invalid mining job");
    return;
  }
  const conversation = await prisma.conversation.findUnique({ where: { id: job.targetId } });
  if (!conversation) { await failJob(jobId, "Conversation not found"); return; }

  const [standards, existingPatterns, categories] = await Promise.all([
    prisma.standard.findMany({ select: { code: true, description: true } }),
    prisma.pattern.findMany({ where: { status: "proposed" }, select: { description: true } }),
    prisma.category.findMany({ select: { name: true } }),
  ]);
  const existingDescriptions = [...standards.map((s) => s.description), ...existingPatterns.map((p) => p.description)];

  try {
    const { patterns, usage } = await minePatterns({
      messages: conversation.parsedMessages.map((m) => ({ author: m.author, content: m.content })),
      existingStandardCodes: standards.map((s) => s.code),
      existingPatternDescriptions: existingDescriptions,
      categoryNames: categories.map((c) => c.name),
    });

    const { fresh, duplicates } = dedupeProposed(patterns, { descriptions: existingDescriptions });

    // Create one-by-one (MongoDB-connector-safe) rather than createMany in a transaction.
    for (const p of fresh) {
      await prisma.pattern.create({
        data: {
          fromConversationId: conversation.id,
          description: p.description,
          suggestedCategory: p.suggestedCategory,
          severity: p.severity,
          occurrences: p.occurrences,
          suggestedStandardText: p.suggestedStandardText,
          evidence: p.evidence.map((e) => ({ quote: e.quote })),
          status: "proposed",
        },
      });
    }

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "done",
        progress: 100,
        finishedAt: new Date(),
        tokenCost: usage.totalTokens,
        result: { proposedCount: fresh.length, duplicatesFiltered: duplicates.length },
      },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "analyzed" } });
  } catch (err) {
    await failJob(jobId, err instanceof Error ? err.message : String(err));
  }
}
