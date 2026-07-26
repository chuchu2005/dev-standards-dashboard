import { openai } from "@/lib/openai/client";
import { miningResponseFormat, type ProposedPatternT } from "@/lib/openai/schemas";
import { env } from "@/lib/env";

export interface MiningUsage { promptTokens: number; completionTokens: number; totalTokens: number; }

export async function minePatterns(input: {
  messages: { author: string; content: string }[];
  existingStandardCodes: string[];
  existingPatternDescriptions: string[];
  categoryNames: string[];
}): Promise<{ patterns: ProposedPatternT[]; usage: MiningUsage }> {
  const transcript = input.messages.map((m) => `${m.author}: ${m.content}`).join("\n");

  const completion = await openai.beta.chat.completions.parse({
    model: env.OPENAI_MINING_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You analyze a chat conversation between a client and a software freelancer.",
          "Extract RECURRING or NOTABLE patterns relevant to software-development standards:",
          "good practices followed, bad practices or violations, and unique notable details.",
          "For each pattern give: a concise description, a suggested category (use one of the listed category names if possible),",
          "severity (blocker/major/minor), an occurrences count, suggested standard text, and AT LEAST ONE direct-quote evidence",
          "from the transcript. Never fabricate quotes. Omit any pattern without real evidence.",
          "Do NOT re-propose known patterns. Known standard codes and pattern descriptions are listed — skip semantically identical ones.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "CATEGORY NAMES: " + input.categoryNames.join(", "),
          "EXISTING STANDARD CODES: " + (input.existingStandardCodes.join(", ") || "(none)"),
          "EXISTING PATTERN DESCRIPTIONS:\n" + (input.existingPatternDescriptions.join("\n") || "(none)"),
          "TRANSCRIPT:\n" + transcript,
        ].join("\n\n"),
      },
    ],
    response_format: miningResponseFormat,
  });

  const parsed = completion.choices[0]?.message.parsed;
  const u = completion.usage;
  return {
    patterns: parsed?.patterns ?? [],
    usage: {
      promptTokens: u?.prompt_tokens ?? 0,
      completionTokens: u?.completion_tokens ?? 0,
      totalTokens: u?.total_tokens ?? 0,
    },
  };
}
