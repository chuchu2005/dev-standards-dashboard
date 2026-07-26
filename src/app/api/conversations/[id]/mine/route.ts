import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = await prisma.job.create({
    data: { type: "mine-patterns", targetType: "conversation", targetId: id, status: "queued" },
  });
  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
