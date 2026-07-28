import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { approvePattern, rejectPattern, mergePattern } from "@/lib/patterns/approve";

const Body = z.object({
  action: z.enum(["approve", "reject", "merge"]),
  categoryId: z.string().min(1).optional(),  // required for approve
  standardId: z.string().min(1).optional(),   // required for merge
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { action, categoryId, standardId } = parsed.data;

  try {
    if (action === "approve") {
      if (!categoryId) return NextResponse.json({ error: "categoryId required for approve" }, { status: 400 });
      const res = await approvePattern(id, categoryId);
      return NextResponse.json(res);
    }
    if (action === "reject") { await rejectPattern(id); return NextResponse.json({ ok: true }); }
    // merge
    if (!standardId) return NextResponse.json({ error: "standardId required for merge" }, { status: 400 });
    await mergePattern(id, standardId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
