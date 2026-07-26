"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MineButton({ conversationId, jobStatus }: { conversationId: string; jobStatus?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Disable while a job is already queued/running to avoid duplicate OpenAI spend.
  const inFlight = jobStatus === "queued" || jobStatus === "running";

  async function onMine() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/conversations/${conversationId}/mine`, { method: "POST" });
    setBusy(false);
    if (!res.ok) { setError("Failed to start mining."); return; }
    router.refresh();
  }

  const label = busy ? "Queuing…" : inFlight ? `Mining… (${jobStatus})` : "⛏ Mine for patterns";

  return (
    <div className="form-actions">
      <button type="button" className="btn" onClick={onMine} disabled={busy || inFlight}>
        {label}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
