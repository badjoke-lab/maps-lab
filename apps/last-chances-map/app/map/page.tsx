"use client";

import dynamic from "next/dynamic";
import { getAllRecords } from "../../lib/records";

const LiveRecordsMap = dynamic(() => import("../../components/LiveRecordsMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 640,
        width: "100%",
        border: "1px solid var(--border)",
        background: "linear-gradient(180deg, #efe6d8 0%, #f8f2e8 100%)",
      }}
    />
  ),
});

export default function MapPage() {
  const records = getAllRecords();

  return (
    <main className="section">
      <div className="container">
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2.4rem", margin: "0 0 16px" }}>Map view</h1>
        <p style={{ color: "var(--text-muted)", margin: "0 0 24px" }}>
          A live basemap view for discovery, with the current archive records placed on top of OpenStreetMap tiles.
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
            <LiveRecordsMap records={records} />
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
