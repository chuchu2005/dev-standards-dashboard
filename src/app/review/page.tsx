import { prisma } from "@/lib/db";
import { ReviewActions } from "./ReviewActions";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const [patterns, categories, standards] = await Promise.all([
    prisma.pattern.findMany({ where: { status: "proposed" }, orderBy: { createdAt: "desc" } }),
    prisma.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
    prisma.standard.findMany({
      where: { status: "approved" },
      select: { id: true, code: true, title: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <>
      <div className="page__head">
        <p className="eyebrow">Review</p>
        <h1 className="page__title">Pattern review queue</h1>
      </div>

      <p className="note">
        {patterns.length === 0
          ? "No proposed patterns right now."
          : `${patterns.length} proposed pattern${patterns.length === 1 ? "" : "s"} awaiting your decision.`}
      </p>

      {patterns.length === 0 ? (
        <p className="empty"><em>Nothing to review. Mine a conversation to generate patterns.</em></p>
      ) : (
        <div className="reveal-list">
          {patterns.map((p) => (
            <section key={p.id} className="block reveal">
              <header className="catalog-category__head">
                <h2 className="section-title">{p.description}</h2>
              </header>

              <dl className="meta-grid">
                <div>
                  <dt>Severity</dt>
                  <dd className={`sev sev-${p.severity}`}>{p.severity}</dd>
                </div>
                <div>
                  <dt>Occurrences</dt>
                  <dd className="cell-num">{p.occurrences}</dd>
                </div>
                {p.suggestedCategory && (
                  <div>
                    <dt>Suggested category</dt>
                    <dd>{p.suggestedCategory}</dd>
                  </div>
                )}
              </dl>

              {p.suggestedStandardText && (
                <>
                  <h3 className="section-title">Suggested standard text</h3>
                  <p className="prose">{p.suggestedStandardText}</p>
                </>
              )}

              {p.evidence.length > 0 && (
                <>
                  <h3 className="section-title">Evidence</h3>
                  <div className="examples">
                    {p.evidence.map((e, i) => (
                      <figure key={i} className="example">
                        <figcaption>Quote</figcaption>
                        <pre><code>“{e.quote}”</code></pre>
                      </figure>
                    ))}
                  </div>
                </>
              )}

              <h3 className="section-title">Decision</h3>
              <ReviewActions
                patternId={p.id}
                categories={categories}
                standards={standards}
                suggestedCategory={p.suggestedCategory}
              />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
