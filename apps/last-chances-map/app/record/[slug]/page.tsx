import { notFound } from "next/navigation";
import { getRecordBySlug, getRelatedRecords, projectRecordPoint } from "../../../lib/records";

export default async function RecordDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = getRecordBySlug(slug);

  if (!record) {
    notFound();
  }

  const related = getRelatedRecords(record, 3);
  const point = projectRecordPoint(record);

  return (
    <main>
      <section className="detail-hero">
        <div className="container">
          <div className="meta" style={{ marginBottom: 12 }}>
            <span className={`badge badge--${record.urgency}`}>{record.urgency}</span>
            <span className="badge">{record.disappearanceReason}</span>
            <span className={`badge ${record.stillAccessible === false ? "badge--lost" : ""}`}>
              {record.stillAccessible === false ? "recently lost" : "still accessible"}
            </span>
          </div>
          <h1>{record.title}</h1>
          <p style={{ color: "var(--text-muted)", maxWidth: 760, margin: 0 }}>{record.summary}</p>
        </div>
      </section>

      <section className="section">
        <div className="container detail-grid">
          <article className="card">
            <h2>Why this matters</h2>
            <p>{record.summary}</p>
            <div className="map-canvas" style={{ minHeight: 280, marginTop: 20 }}>
              <div className={`map-point map-point--${record.urgency} ${record.stillAccessible === false ? "map-point--lost" : ""}`} style={{ left: `${point.left}%`, top: `${point.top}%` }} />
            </div>
            <div className="meta" style={{ marginTop: 12 }}>
              <span>{record.city}</span>
              <span>{record.area}</span>
              <span>{record.category}</span>
            </div>

            <h2 style={{ marginTop: 28 }}>Evidence</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {record.evidenceLinks.map((link) => (
                <a key={link.id} className="card" style={{ padding: 12 }} href={link.url} target="_blank" rel="noreferrer">
                  <strong>{link.label}</strong>
                  <div className="meta" style={{ marginTop: 6 }}>
                    <span>{link.kind}</span>
                    <span>{record.sourceType}</span>
                    <span>{record.confidence} confidence</span>
                  </div>
                </a>
              ))}
            </div>
          </article>

          <aside className="card">
            <h2>Key facts</h2>
            <dl className="key-facts">
              <div>
                <dt>City</dt>
                <dd>{record.city}</dd>
              </div>
              <div>
                <dt>Area</dt>
                <dd>{record.area}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{record.stillAccessible === false ? "Recently lost" : "Still accessible"}</dd>
              </div>
              <div>
                <dt>Urgency</dt>
                <dd>{record.urgency}</dd>
              </div>
              <div>
                <dt>Reason</dt>
                <dd>{record.disappearanceReason}</dd>
              </div>
              <div>
                <dt>Last seen</dt>
                <dd>{record.lastSeenAt ?? "Unknown"}</dd>
              </div>
              <div>
                <dt>Expected end date</dt>
                <dd>{record.expectedEndDate ?? "Unclear"}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{record.confidence}</dd>
              </div>
            </dl>

            <h2 style={{ marginTop: 28 }}>Related records</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {related.map((candidate) => (
                <a key={candidate.id} className="card" style={{ padding: 12 }} href={`/record/${candidate.slug}`}>
                  <strong>{candidate.title}</strong>
                  <div className="meta" style={{ marginTop: 6 }}>
                    <span>{candidate.city}</span>
                    <span>{candidate.category}</span>
                  </div>
                </a>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
