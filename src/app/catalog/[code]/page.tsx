import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StandardDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const standard = await prisma.standard.findUnique({
    where: { code },
    include: { category: true },
  });
  if (!standard) notFound();

  return (
    <>
      <p><a href="/catalog">← Catalog</a></p>
      <h1>{standard.code}: {standard.title}</h1>
      <p><strong>Category:</strong> {standard.category?.name ?? "—"} · <strong>Severity:</strong> {standard.severity} · <strong>Status:</strong> {standard.status}</p>
      <p><strong>Applies to:</strong> {standard.appliesTo.join(", ")}</p>
      <h2>Description</h2>
      <p>{standard.description}</p>
      <h2>How to check</h2>
      <p>{standard.howToCheck}</p>
      {standard.examples && (standard.examples.good || standard.examples.bad) && (
        <>
          <h2>Examples</h2>
          {standard.examples.good && <p><strong>Good:</strong> <code>{standard.examples.good}</code></p>}
          {standard.examples.bad && <p><strong>Bad:</strong> <code>{standard.examples.bad}</code></p>}
        </>
      )}
    </>
  );
}
