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
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: "48rem", marginTop: "1rem" }}>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input placeholder="Developer name" value={developerName} onChange={(e) => setDeveloperName(e.target.value)} required />
      <textarea placeholder="Paste the full conversation here…" value={rawText}
        onChange={(e) => setRawText(e.target.value)} required rows={12} style={{ fontFamily: "ui-monospace, monospace" }} />
      <button type="submit" disabled={busy}>{busy ? "Ingesting…" : "Ingest conversation"}</button>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
    </form>
  );
}
