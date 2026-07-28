import { cookies } from "next/headers";
import { signSession, verifySession, COOKIE_NAME } from "@/lib/auth/jwt";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function createSession(): Promise<void> {
  const token = await signSession();
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySession(token);
}
