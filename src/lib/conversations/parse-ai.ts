import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { openai } from "@/lib/openai/client";
import { env } from "@/lib/env";
import type { ParsedMessage } from "./parse";

export const AIChatMessage = z.object({
  author: z.string(),
  role: z.enum(["client", "freelancer"]),
  content: z.string(),
});

export const AIChatParse = z.object({
  messages: z.array(AIChatMessage),
});

export const aiChatParseFormat = zodResponseFormat(AIChatParse, "chat_parse");

/**
 * AI-based role identification for pasted client/freelancer chats.
 * Throws on any API/parse failure or when no messages are returned for non-empty
 * input — callers should fall back to the heuristic parser on throw.
 */
export async function parseConversationWithAI(raw: string, developerName: string): Promise<ParsedMessage[]> {
  const systemPrompt =
    `You are parsing a pasted chat between a CLIENT and a FREELANCER on a freelance software-dev platform. ` +
    `The freelancer is named ${developerName}. ` +
    `For each distinct message turn, classify the speaker's role: the FREELANCER is the one proposing/implementing the work; ` +
    `the CLIENT is the one requesting/describing it. Use BOTH the supplied name AND the conversational context — ` +
    `names may be missing or ambiguous, so weigh the message content as well. ` +
    `Output one entry per distinct message turn with the speaker's author name, role, and the message content ` +
    `**verbatim** (never summarize, paraphrase, or fabricate). If there is genuinely no conversation, return an empty array.`;

  const completion = await openai.beta.chat.completions.parse({
    model: env.OPENAI_MINING_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: raw },
    ],
    response_format: aiChatParseFormat,
  });

  const parsed = completion.choices[0]?.message.parsed;
  const messages = parsed?.messages ?? [];

  if (raw.trim().length > 0 && messages.length === 0) {
    throw new Error("parseConversationWithAI: no messages returned for non-empty input");
  }

  return messages.map((m) => ({
    role: m.role,
    author: m.author,
    content: m.content,
    timestamp: null,
  }));
}
