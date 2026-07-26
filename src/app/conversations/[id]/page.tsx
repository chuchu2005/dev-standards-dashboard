import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = await prisma.conversation.findUnique({ where: { id }, include: { developer: true } });
  if (!conv) notFound();

  return (
    <>
      <p className="back-link"><a href="/conversations">← Conversations</a></p>

      <div className="page__head">
        <p className="eyebrow">Conversation</p>
        <h1 className="page__title">{conv.title}</h1>
      </div>

      <dl className="meta-grid">
        <div>
          <dt>Developer</dt>
          <dd>{conv.developer?.name ?? conv.developerName}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd><span className="badge">{conv.status}</span></dd>
        </div>
      </dl>

      <h2 className="section-title">Messages</h2>
      <ol className="message-list">
        {conv.parsedMessages.map((m, i) => (
          <li key={i} className={`message message--${m.role} reveal`}>
            <header className="message__head">
              <span className="message__author">{m.author || "—"}</span>
              <span className="badge">{m.role}</span>
            </header>
            <pre className="message__body">{m.content}</pre>
          </li>
        ))}
      </ol>

      <p className="note"><em>AI pattern-mining arrives in Phase 1 Chunk 4.</em></p>
    </>
  );
}
