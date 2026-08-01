import OpenAI from "openai";
import { env } from "@/lib/env";

let _openai: OpenAI | undefined;

export function openai(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: env().OPENAI_API_KEY });
  }
  return _openai;
}
