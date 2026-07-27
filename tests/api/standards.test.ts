import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/standards/[code]/route";
import { prisma } from "@/lib/db";

function req(code: string, body: unknown) {
  return new NextRequest(`http://localhost/api/standards/${code}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("PATCH /api/standards/[code]", () => {
  it("updates fields and bumps version", async () => {
    const s = await prisma.standard.create({ data: { code: "EDIT-001", title: "T", description: "d", howToCheck: "c", appliesTo: ["all"] } });
    const res = await PATCH(req("EDIT-001", { howToCheck: "Updated check.", severity: "blocker" }), { params: Promise.resolve({ code: "EDIT-001" }) });
    expect(res.status).toBe(200);
    const after = await prisma.standard.findUnique({ where: { code: "EDIT-001" } });
    expect(after?.howToCheck).toBe("Updated check.");
    expect(after?.severity).toBe("blocker");
    expect(after?.version).toBe(s.version + 1);
  });

  it("returns 404 for an unknown code", async () => {
    const res = await PATCH(req("NOPE-999", { description: "x" }), { params: Promise.resolve({ code: "NOPE-999" }) });
    expect(res.status).toBe(404);
  });
});
