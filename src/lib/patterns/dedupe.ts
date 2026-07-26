import type { ProposedPatternT } from "@/lib/openai/schemas";

const STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "for", "is", "are", "on", "with", "that", "this", "it", "as", "by", "at", "be", "should", "must", "all", "use"]);

function tokens(s: string): Set<string> {
  return new Set(
    (s.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? [])
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export const DEDUPE_THRESHOLD = 0.5;

export function dedupeProposed(
  proposed: ProposedPatternT[],
  existing: { descriptions: string[] },
  threshold: number = DEDUPE_THRESHOLD,
): { fresh: ProposedPatternT[]; duplicates: ProposedPatternT[] } {
  const existingSets = existing.descriptions.map(tokens);
  const fresh: ProposedPatternT[] = [];
  const duplicates: ProposedPatternT[] = [];
  for (const p of proposed) {
    const ps = tokens(p.description);
    const isDup = existingSets.some((es) => jaccard(ps, es) >= threshold);
    (isDup ? duplicates : fresh).push(p);
  }
  return { fresh, duplicates };
}
