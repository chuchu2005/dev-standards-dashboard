import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { standards: { orderBy: { code: "asc" } } },
  });

  return (
    <>
      <h1>Standards Catalog</h1>
      {categories.map((c) => (
        <section key={c.id} style={{ marginBottom: "2rem" }}>
          <h2>{c.name}</h2>
          <p style={{ color: "#888", marginTop: "-.5rem" }}>{c.description}</p>
          {c.standards.length === 0 ? (
            <p style={{ color: "#aaa" }}><em>No standards yet — add via review or mining.</em></p>
          ) : (
            <table>
              <thead><tr><th>Code</th><th>Title</th><th>Severity</th><th>Status</th></tr></thead>
              <tbody>
                {c.standards.map((s) => (
                  <tr key={s.id}>
                    <td><a href={`/catalog/${s.code}`}>{s.code}</a></td>
                    <td>{s.title}</td>
                    <td className={`sev-${s.severity}`}>{s.severity}</td>
                    <td><span className="badge">{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}
