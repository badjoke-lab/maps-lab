import { getAllRecords } from "../../lib/records";

export default function ListPage() {
  const records = getAllRecords();

  return (
    <main className="section">
      <div className="container">
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2.4rem", margin: "0 0 16px" }}>Archive list</h1>
        <p style={{ color: "var(--text-muted)", margin: "0 0 24px" }}>
          Every current record in the Last Chances archive, ordered for reading rather than map exploration.
        </p>
        <div className="list-grid">
          {records.map((record) => (
            <article key={record.id} className="card record-card">
              <div className="meta">
                <span className={`badge badge--${record.urgency}`}>{record.urgency}</span>
                <span className={`badge ${record.stillAccessible === false ? "badge--lost" : ""}`}>
                  {record.stillAccessible === false ? "recently lost" : "still accessible"}
                </span>
                <span className="badge">{record.disappearanceReason}</span>
              </div>
              <h2 className="record-card__title">{record.title}</h2>
              <p className="record-card__summary">{record.summary}</p>
              <div className="meta">
                <span>{record.city}</span>
                <span>{record.area}</span>
                <span>{record.category}</span>
              </div>
              <div className="meta">
                {record.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="badge">{tag}</span>
                ))}
              </div>
              <div className="record-card__footer meta">
                <span>Source: {record.evidenceLinks[0]?.label ?? "n/a"}</span>
                <a href={`/record/${record.slug}`}>View detail</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
