import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { standards: { orderBy: { code: "asc" } } },
  });

  return (
    <>
      <div className="page__head">
        <p className="eyebrow">Reference</p>
        <h1 className="page__title">Standards Catalog</h1>
      </div>

      <div className="reveal-list">
        {categories.map((c) => (
          <section key={c.id} className="catalog-category reveal">
            <header className="catalog-category__head">
              <h2 className="section-title">{c.name}</h2>
              <p className="catalog-category__desc">{c.description}</p>
            </header>
            {c.standards.length === 0 ? (
              <p className="empty"><em>No standards yet — add via review or mining.</em></p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Code</th><th>Title</th><th>Severity</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {c.standards.map((s) => (
                    <tr key={s.id}>
                      <td className="cell-code"><a href={`/catalog/${s.code}`}>{s.code}</a></td>
                      <td>{s.title}</td>
                      <td className={`sev sev-${s.severity}`}>{s.severity}</td>
                      <td><span className="badge">{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
