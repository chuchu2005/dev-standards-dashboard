import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = await prisma.conversation.findUnique({ where: { id }, include: { developer: true } });
  if (!conv) notFound();

  return (
    <>
      <p><a href="/conversations">← Conversations</a></p>
      <h1>{conv.title}</h1>
      <p>
        <strong>Developer:</strong> {conv.developer?.name ?? conv.developerName} ·{" "}
        <strong>Status:</strong> <span className="badge">{conv.status}</span>
      </p>

      <h2>Messages</h2>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {conv.parsedMessages.map((m, i) => (
          <div key={i} style={{
            padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
            background: m.role === "freelancer" ? "#eef2ff" : "#f3f4f6",
          }}>
            <strong>{m.author || "—"}</strong>{" "}
            <span className="badge">{m.role}</span>
            <pre style={{ whiteSpace: "pre-wrap", margin: "0.25rem 0 0", fontFamily: "inherit" }}>{m.content}</pre>
          </div>
        ))}
      </div>

      <p style={{ color: "#888", marginTop: "1.5rem" }}><em>AI pattern-mining arrives in Phase 1 Chunk 4.</em></p>
    </>
  );
}
