import { getAllRecords, projectRecordPoint } from "../../lib/records";

export default function MapPage() {
  const records = getAllRecords();

  return (
    <main className="section">
      <div className="container">
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2.4rem", margin: "0 0 16px" }}>Map view</h1>
        <p style={{ color: "var(--text-muted)", margin: "0 0 24px" }}>
          A lightweight first-pass map that places each record inside the archive bounds. This is the discovery view.
        </p>
        <div className="map-layout">
          <aside className="map-panel">
            <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Visible records</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {records.map((record) => (
                <article key={record.id} className="card" style={{ padding: 12 }}>
                  <div className="meta">
                    <span className={`badge badge--${record.urgency}`}>{record.urgency}</span>
                    <span className={`badge ${record.stillAccessible === false ? "badge--lost" : ""}`}>
                      {record.stillAccessible === false ? "recently lost" : "still accessible"}
                    </span>
                  </div>
                  <h3 style={{ marginBottom: 8 }}>{record.title}</h3>
                  <div className="meta" style={{ marginBottom: 8 }}>
                    <span>{record.city}</span>
                    <span>{record.area}</span>
                  </div>
                  <a href={`/record/${record.slug}`}>View detail</a>
                </article>
              ))}
            </div>
          </aside>
          <section>
            <div className="map-canvas" aria-label="Record map">
              {records.map((record) => {
                const point = projectRecordPoint(record);
                const pointClass = `map-point map-point--${record.urgency} ${record.stillAccessible === false ? "map-point--lost" : ""}`;
                return (
                  <a
                    key={record.id}
                    href={`/record/${record.slug}`}
                    className={pointClass}
                    style={{ left: `${point.left}%`, top: `${point.top}%` }}
                    title={record.title}
                  />
                );
              })}
            </div>
            <div className="map-legend">
              <span><span className="badge badge--critical">critical / high</span></span>
              <span><span className="badge badge--medium">medium</span></span>
              <span><span className="badge badge--lost">recently lost</span></span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
