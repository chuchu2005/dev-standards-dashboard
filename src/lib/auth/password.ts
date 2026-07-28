// Plaintext compare. Password lives in AUTH_PASSWORD (.env, gitignored). Single-user internal tool.
export function verifyPassword(plain: string, expected: string): boolean {
  return plain === expected;
}
