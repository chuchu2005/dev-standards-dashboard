import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

export const COOKIE_NAME = "dsd_session";

const encoder = new TextEncoder();
const key = () => encoder.encode(env.SESSION_SECRET);

export async function signSession(): Promise<string> {
  return new SignJWT({ authed: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key());
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, key());
    return true;
  } catch {
    return false;
  }
}
