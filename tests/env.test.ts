import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("env", () => {
  const original = { ...process.env };

  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env = { ...original }; });

  it("parses a valid environment", async () => {
    Object.assign(process.env, {
      DATABASE_URL: "mongodb://localhost:27017/test",
      OPENAI_API_KEY: "sk-test",
      AUTH_PASSWORD: "test-password",
      SESSION_SECRET: "x".repeat(32),
    });
    const { env } = await import("@/lib/env");
    expect(env.DATABASE_URL).toBe("mongodb://localhost:27017/test");
    expect(env.OPENAI_MINING_MODEL).toBe("gpt-4o-mini"); // default applied
  });

  it("rejects a missing DATABASE_URL", async () => {
    Object.assign(process.env, {
      OPENAI_API_KEY: "sk-test",
      AUTH_PASSWORD: "test-password",
      SESSION_SECRET: "x".repeat(32),
    });
    delete process.env.DATABASE_URL;
    await expect(import("@/lib/env")).rejects.toThrow();
  });

  it("rejects a too-short session secret", async () => {
    Object.assign(process.env, {
      DATABASE_URL: "mongodb://localhost:27017/test",
      OPENAI_API_KEY: "sk-test",
      AUTH_PASSWORD: "test-password",
      SESSION_SECRET: "short",
    });
    await expect(import("@/lib/env")).rejects.toThrow();
  });
});
