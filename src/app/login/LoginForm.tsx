"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, null);
  return (
    <form action={formAction} className="form">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span className="field__label">Password</span>
        <input type="password" name="password" required autoComplete="current-password" />
      </label>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </div>
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
    </form>
  );
}
