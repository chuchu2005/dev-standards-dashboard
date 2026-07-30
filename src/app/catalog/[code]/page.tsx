import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { EditStandardForm } from "./EditStandardForm";

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
      <p className="back-link"><a href="/catalog">← Catalog</a></p>

      <div className="page__head">
        <p className="eyebrow">{standard.category?.name ?? "Standard"}</p>
        <h1 className="page__title">
          <span className="page__title-code">{standard.code}</span>
          {standard.title}
        </h1>
      </div>

      <dl className="meta-grid">
        <div>
          <dt>Category</dt>
          <dd>{standard.category?.name ?? "—"}</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd className={`sev sev-${standard.severity}`}>{standard.severity}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd><span className="badge">{standard.status}</span></dd>
        </div>
      </dl>

      <h2 className="section-title">Description</h2>
      <p className="prose">{standard.description}</p>

      <h2 className="section-title">How to check</h2>
      <p className="prose">{standard.howToCheck}</p>

      {(standard.examples?.good || standard.examples?.bad) && (
        <>
          <h2 className="section-title">Examples</h2>
          <div className="examples">
            {standard.examples?.good && (
              <figure className="example example--good">
                <figcaption>Good</figcaption>
                <pre><code>{standard.examples.good}</code></pre>
              </figure>
            )}
            {standard.examples?.bad && (
              <figure className="example example--bad">
                <figcaption>Bad</figcaption>
                <pre><code>{standard.examples.bad}</code></pre>
              </figure>
            )}
          </div>
        </>
      )}

      <section className="block">
        <h2 className="section-title">Edit standard</h2>
        <p className="note">Version {standard.version}. Saving bumps the version and updates the field immediately.</p>
        <EditStandardForm
          code={standard.code}
          initial={{
            title: standard.title,
            description: standard.description,
            howToCheck: standard.howToCheck,
            severity: standard.severity,
            status: standard.status,
          }}
        />
      </section>
    </>
  );
}
