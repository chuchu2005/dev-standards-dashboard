"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditStandardForm({ code, initial }: {
  code: string;
  initial: {
    title: string;
    description: string;
    howToCheck: string;
    severity: string;
    status: string;
  };
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    // appliesTo is hidden from the UI (meaningless for engagement standards);
    // keep the API contract stable by always sending ["all"].
    const res = await fetch(`/api/standards/${code}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, appliesTo: ["all"] }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Saved.");
      router.refresh();
    } else {
      setErr("Failed to save.");
    }
  }

  return (
    <form onSubmit={save} className="form form--wide">
      <label className="field">
        <span className="field__label">Title</span>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </label>
      <label className="field">
        <span className="field__label">Description</span>
        <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} />
      </label>
      <label className="field">
        <span className="field__label">How to check</span>
        <textarea value={f.howToCheck} onChange={(e) => setF({ ...f, howToCheck: e.target.value })} rows={3} />
      </label>
      <label className="field">
        <span className="field__label">Severity</span>
        <select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>
          <option>blocker</option>
          <option>major</option>
          <option>minor</option>
        </select>
      </label>
      <label className="field">
        <span className="field__label">Status</span>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option>draft</option>
          <option>approved</option>
          <option>deprecated</option>
        </select>
      </label>
      <div className="form-actions">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        {msg && <span className="note" role="status">{msg}</span>}
        {err && <p className="form-error" role="alert">{err}</p>}
      </div>
    </form>
  );
}
