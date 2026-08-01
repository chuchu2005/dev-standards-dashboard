import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  AUTH_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  OPENAI_MINING_MODEL: z.string().default("gpt-4o-mini"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let _env: Env | undefined;

/** Lazily validated – avoids crashing the Next.js build when secrets aren't in the CI env. */
export function env(): Env {
  if (!_env) {
    _env = schema.parse(process.env);
  }
  return _env;
}
