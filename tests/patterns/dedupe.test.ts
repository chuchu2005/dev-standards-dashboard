import { describe, it, expect } from "vitest";
import { dedupeProposed } from "@/lib/patterns/dedupe";

const P = (description: string) => ({ description, suggestedCategory: null, severity: "minor" as const, occurrences: 1, suggestedStandardText: null, evidence: [{ quote: "q" }] });

describe("dedupeProposed", () => {
  it("keeps a pattern with no similar existing entry", () => {
    const { fresh, duplicates } = dedupeProposed([P("Use conventional commit messages everywhere")], { descriptions: [] });
    expect(fresh).toHaveLength(1);
    expect(duplicates).toHaveLength(0);
  });

  it("filters a proposed pattern that closely matches an existing standard", () => {
    const { fresh, duplicates } = dedupeProposed(
      [P("commits should follow conventional commit message format")],
      { descriptions: ["Commit subjects follow Conventional Commits format"] },
    );
    expect(fresh).toHaveLength(0);
    expect(duplicates).toHaveLength(1);
  });

  it("passes through unrelated patterns", () => {
    const { fresh } = dedupeProposed(
      [P("All API responses include a correlation id"), P("Database indexes on foreign keys")],
      { descriptions: ["Use conventional commit messages"] },
    );
    expect(fresh).toHaveLength(2);
  });
});
