"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function MineButton({ conversationId, jobStatus }: { conversationId: string; jobStatus?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Disable while a job is already queued/running to avoid duplicate OpenAI spend.
  const inFlight = jobStatus === "queued" || jobStatus === "running";

  // Hand off from the local `busy` flag to the server-driven `inFlight` flag
  // once the refreshed page confirms the job is queued/running. This closes the
  // race where `busy` was cleared before `router.refresh()` delivered the new
  // status, briefly re-enabling the button and allowing a duplicate enqueue.
  useEffect(() => {
    if (inFlight) setBusy(false);
  }, [inFlight]);

  async function onMine() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/conversations/${conversationId}/mine`, { method: "POST" });
    if (!res.ok) {
      setBusy(false);
      setError("Failed to start mining.");
      return;
    }
    // Do NOT clear `busy` here — keep the button disabled until the server-driven
    // `inFlight` flag takes over via the effect above.
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
