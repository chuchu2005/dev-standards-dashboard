import bcrypt from "bcryptjs";

// The hash lives in AUTH_PASSWORD_HASH (env). The app only ever verifies, never hashes.
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
