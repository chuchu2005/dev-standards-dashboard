import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { MineButton } from "./MineButton";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = await prisma.conversation.findUnique({ where: { id }, include: { developer: true } });
  if (!conv) notFound();

  const [latestJob, proposedCount] = await Promise.all([
    prisma.job.findFirst({ where: { targetId: id }, orderBy: { createdAt: "desc" } }),
    prisma.pattern.count({ where: { fromConversationId: id, status: "proposed" } }),
  ]);

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

      <section className="block">
        <h2 className="section-title">Pattern mining</h2>
        <dl className="meta-grid">
          <div>
            <dt>Latest job</dt>
            <dd>
              {latestJob ? (
                <>
                  <span className="badge">{latestJob.status}</span>
                  {latestJob.tokenCost ? <> · {latestJob.tokenCost} tokens</> : null}
                </>
              ) : (
                <span className="note">none</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Proposed patterns awaiting review</dt>
            <dd><strong>{proposedCount}</strong></dd>
          </div>
        </dl>
        <MineButton conversationId={conv.id} jobStatus={latestJob?.status} />
        {latestJob?.status === "failed" && (
          <p className="form-error">Last job failed: {latestJob.error}</p>
        )}
      </section>

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
    </>
  );
}
