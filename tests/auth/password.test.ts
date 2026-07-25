// tests/auth/password.test.ts
import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { verifyPassword } from "@/lib/auth/password";

describe("verifyPassword", () => {
  const hash = bcrypt.hashSync("correct horse", 4); // low cost for test speed

  it("returns true for the correct password", async () => {
    expect(await verifyPassword("correct horse", hash)).toBe(true);
  });

  it("returns false for a wrong password", async () => {
    expect(await verifyPassword("battery staple", hash)).toBe(false);
  });
});
