import { prisma } from "@/lib/db";

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Mined standards get a simple global STD-NNN code (authored exemplars keep semantic codes like VC-001).
// Single-user sequential approves won't collide; the @unique(code) guard backstops any race.
async function nextStandardCode(): Promise<string> {
  const count = await prisma.standard.count({ where: { code: { startsWith: "STD-" } } });
  return `STD-${String(count + 1).padStart(3, "0")}`;
}

export async function approvePattern(patternId: string, categoryId: string): Promise<{ standardId: string; code: string }> {
  const pattern = await prisma.pattern.findUnique({ where: { id: patternId } });
  if (!pattern) throw new Error("Pattern not found");
  if (pattern.status !== "proposed") throw new Error(`Pattern is not proposed (status: ${pattern.status})`);

  const code = await nextStandardCode();
  const standard = await prisma.standard.create({
    data: {
      code,
      title: truncate(pattern.description, 80),
      description: pattern.suggestedStandardText ?? pattern.description,
      categoryId,
      severity: pattern.severity,
      status: "approved",
      howToCheck: "", // refine via the catalog editor after approval (Task 5.3)
      appliesTo: ["all"],
      source: "mined",
      sourceConversationId: pattern.fromConversationId,
    },
  });
  await prisma.pattern.update({
    where: { id: patternId },
    data: { status: "approved-as-standard", linkedStandardId: standard.id, reviewedAt: new Date() },
  });
  return { standardId: standard.id, code: standard.code };
}

export async function rejectPattern(patternId: string): Promise<void> {
  const pattern = await prisma.pattern.findUnique({ where: { id: patternId } });
  if (!pattern) throw new Error("Pattern not found");
  if (pattern.status !== "proposed") throw new Error(`Pattern is not proposed (status: ${pattern.status})`);
  await prisma.pattern.update({ where: { id: patternId }, data: { status: "rejected", reviewedAt: new Date() } });
}

export async function mergePattern(patternId: string, standardId: string): Promise<void> {
  const pattern = await prisma.pattern.findUnique({ where: { id: patternId } });
  if (!pattern) throw new Error("Pattern not found");
  if (pattern.status !== "proposed") throw new Error(`Pattern is not proposed (status: ${pattern.status})`);
  const standard = await prisma.standard.findUnique({ where: { id: standardId } });
  if (!standard) throw new Error("Standard not found");
  await prisma.pattern.update({
    where: { id: patternId },
    data: { status: "merged", linkedStandardId: standardId, reviewedAt: new Date() },
  });
}
