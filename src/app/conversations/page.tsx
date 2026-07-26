import { prisma } from "@/lib/db";
import { IngestForm } from "./IngestForm";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: "desc" },
    include: { developer: true },
  });
  return (
    <>
      <div className="page__head">
        <p className="eyebrow">Review</p>
        <h1 className="page__title">Conversations</h1>
      </div>

      <section className="block">
        <h2 className="section-title">Ingest a new conversation</h2>
        <IngestForm />
      </section>

      <section className="block">
        <h2 className="section-title">Past conversations</h2>
        {conversations.length === 0 ? (
          <p className="empty"><em>None yet.</em></p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Title</th><th>Developer</th><th>Status</th><th>Messages</th></tr>
            </thead>
            <tbody>
              {conversations.map((c) => (
                <tr key={c.id} className="reveal">
                  <td><a href={`/conversations/${c.id}`}>{c.title}</a></td>
                  <td>{c.developer?.name ?? c.developerName}</td>
                  <td><span className="badge">{c.status}</span></td>
                  <td className="cell-num">{c.parsedMessages.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
