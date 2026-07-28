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
export const env = schema.parse(process.env);
