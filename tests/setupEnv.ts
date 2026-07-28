// tests/setupEnv.ts
process.env.DATABASE_URL ??= "mongodb://localhost:27017/unused";
process.env.OPENAI_API_KEY ??= "sk-test";
process.env.AUTH_PASSWORD ??= "test-password";
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-32+";
process.env.OPENAI_MINING_MODEL ??= "gpt-4o-mini";
