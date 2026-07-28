import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseConversation } from "@/lib/conversations/parse";

const Body = z.object({
  title: z.string().min(1),
  developerName: z.string().min(1),
  rawText: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, developerName, rawText } = parsed.data;
  const messages = parseConversation(rawText, developerName);

  // Materialize one bare Developer per distinct exact name (spec §4.7). Alias/variant merge is Phase 3.
  const existing = await prisma.developer.findFirst({ where: { name: developerName } });
  const developer = existing ?? (await prisma.developer.create({ data: { name: developerName } }));

  const conversation = await prisma.conversation.create({
    data: { title, developerName, developerId: developer.id, rawText, parsedMessages: messages, status: "ingested" },
  });
  return NextResponse.json({ id: conversation.id }, { status: 201 });
}

export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: "desc" },
    include: { developer: true },
  });
  return NextResponse.json(conversations);
}
