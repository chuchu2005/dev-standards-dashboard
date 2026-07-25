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
      <h1>Conversations</h1>
      <h2>Ingest a new conversation</h2>
      <IngestForm />

      <h2 style={{ marginTop: "2rem" }}>Past conversations</h2>
      {conversations.length === 0 ? (
        <p style={{ color: "#aaa" }}><em>None yet.</em></p>
      ) : (
        <table>
          <thead><tr><th>Title</th><th>Developer</th><th>Status</th><th>Messages</th></tr></thead>
          <tbody>
            {conversations.map((c) => (
              <tr key={c.id}>
                <td><a href={`/conversations/${c.id}`}>{c.title}</a></td>
                <td>{c.developer?.name ?? c.developerName}</td>
                <td><span className="badge">{c.status}</span></td>
                <td>{c.parsedMessages.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
