"use server";

import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";

export type LoginState = { error?: string } | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const ok = verifyPassword(password, env().AUTH_PASSWORD);
  if (!ok) return { error: "Incorrect password." };
  await createSession();
  const next = String(formData.get("next") ?? "/catalog");
  // Only allow single-slash internal paths; reject "//" (protocol-relative) and "\\" (backslash-normalized) to prevent open redirect.
  redirect(next.startsWith("/") && !next.startsWith("//") && !next.startsWith("\\") ? next : "/catalog");
}
