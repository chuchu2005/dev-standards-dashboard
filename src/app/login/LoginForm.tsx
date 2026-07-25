"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, null);
  return (
    <form action={formAction} style={{ display: "grid", gap: "0.75rem", maxWidth: "20rem" }}>
      <input type="hidden" name="next" value={next} />
      <label>
        Password
        <input type="password" name="password" required autoComplete="current-password" />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      {state?.error && <p style={{ color: "#b91c1c" }}>{state.error}</p>}
    </form>
  );
}
