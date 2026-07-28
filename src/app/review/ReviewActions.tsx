"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewActions({
  patternId,
  categories,
  standards,
  suggestedCategory,
}: {
  patternId: string;
  categories: { id: string; name: string }[];
  standards: { id: string; code: string; title: string }[];
  suggestedCategory: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const defaultCat =
    categories.find((c) => c.name.toLowerCase() === (suggestedCategory ?? "").toLowerCase())?.id ??
    categories[0]?.id ??
    "";
  const [categoryId, setCategoryId] = useState(defaultCat);
  const [standardId, setStandardId] = useState(standards[0]?.id ?? "");

  async function act(action: "approve" | "reject" | "merge", extra: Record<string, string> = {}) {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/patterns/${patternId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setErr(body?.error ?? "Failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="form form--wide">
      <div className="form-actions">
        <label className="field">
          <span className="field__label">Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={busy}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn"
          disabled={busy || !categoryId}
          onClick={() => act("approve", { categoryId })}
        >
          Approve as standard
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => act("reject")}
        >
          Reject
        </button>
      </div>
      <div className="form-actions">
        <label className="field">
          <span className="field__label">Merge into</span>
          <select
            value={standardId}
            onChange={(e) => setStandardId(e.target.value)}
            disabled={busy}
          >
            {standards.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.title}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy || !standardId}
          onClick={() => act("merge", { standardId })}
        >
          Merge
        </button>
      </div>
      {err && <p className="form-error" role="alert">{err}</p>}
    </div>
  );
}
