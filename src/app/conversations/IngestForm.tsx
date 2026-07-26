"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IngestForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [developerName, setDeveloperName] = useState("");
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, developerName, rawText }),
    });
    setBusy(false);
    if (!res.ok) { setError("Failed to ingest conversation."); return; }
    const { id } = await res.json();
    router.push(`/conversations/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="form form--wide">
      <label className="field">
        <span className="field__label">Title</span>
        <input placeholder="Conversation title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="field">
        <span className="field__label">Developer name</span>
        <input placeholder="Developer" value={developerName} onChange={(e) => setDeveloperName(e.target.value)} required />
      </label>
      <label className="field">
        <span className="field__label">Raw transcript</span>
        <textarea
          className="textarea-mono"
          placeholder="Paste the full conversation here…"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          required
          rows={12}
        />
      </label>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Ingesting…" : "Ingest conversation"}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
