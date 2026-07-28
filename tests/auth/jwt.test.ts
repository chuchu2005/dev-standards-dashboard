// tests/auth/jwt.test.ts
import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "@/lib/auth/jwt";

describe("session token", () => {
  it("round-trips a freshly signed token", async () => {
    const token = await signSession();
    expect(await verifySession(token)).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const token = await signSession();
    expect(await verifySession(token + "x")).toBe(false);
  });

  it("rejects garbage", async () => {
    expect(await verifySession("not-a-token")).toBe(false);
  });
});
