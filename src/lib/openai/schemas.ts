import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

export const ProposedPattern = z.object({
  description: z.string(),
  suggestedCategory: z.string().nullable(),
  severity: z.enum(["blocker", "major", "minor"]),
  occurrences: z.number().int().min(1),
  suggestedStandardText: z.string().nullable(),
  evidence: z.array(z.object({ quote: z.string() })).min(1), // ≥1 direct quote, always
});

export const MiningResult = z.object({
  patterns: z.array(ProposedPattern),
});

export const miningResponseFormat = zodResponseFormat(MiningResult, "mining_result");
export type ProposedPatternT = z.infer<typeof ProposedPattern>;
