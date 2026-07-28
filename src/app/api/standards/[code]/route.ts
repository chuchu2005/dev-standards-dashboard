import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const Body = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  howToCheck: z.string().optional(),
  severity: z.enum(["blocker", "major", "minor"]).optional(),
  status: z.enum(["draft", "approved", "deprecated"]).optional(),
  appliesTo: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.standard.findUnique({ where: { code } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Simple versioning: bump version on each edit. Full revision history (diffs) is a later phase.
  await prisma.standard.update({
    where: { code },
    data: { ...parsed.data, version: { increment: 1 } },
  });
  return NextResponse.json({ ok: true });
}
