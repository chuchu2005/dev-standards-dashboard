// tests/auth/password.test.ts
import { describe, it, expect } from "vitest";
import { verifyPassword } from "@/lib/auth/password";

describe("verifyPassword", () => {
  const expected = "correct horse";

  it("returns true for the correct password", () => {
    expect(verifyPassword("correct horse", expected)).toBe(true);
  });

  it("returns false for a wrong password", () => {
    expect(verifyPassword("battery staple", expected)).toBe(false);
  });
});
