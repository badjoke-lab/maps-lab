import { getAllRecords, getCityCounts } from "../../lib/records";

export default function StatsPage() {
  const records = getAllRecords();
  const cityCounts = getCityCounts();
  const byCategory = Object.entries(
    records.reduce<Record<string, number>>((acc, record) => {
      acc[record.category] = (acc[record.category] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const byReason = Object.entries(
    records.reduce<Record<string, number>>((acc, record) => {
      acc[record.disappearanceReason] = (acc[record.disappearanceReason] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const stillAccessible = records.filter((record) => record.stillAccessible !== false).length;
  const recentlyLost = records.filter((record) => record.stillAccessible === false).length;

  return (
    <main className="section">
      <div className="container">
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2.4rem", margin: "0 0 16px" }}>Stats</h1>
        <p style={{ color: "var(--text-muted)", margin: "0 0 24px" }}>
          A first-pass overview of the current Last Chances archive. History-aware stats will be added later without breaking this page structure.
        </p>

        <div className="grid-2" style={{ marginBottom: 24 }}>
          <article className="card"><h3>Total records</h3><p>{records.length}</p></article>
          <article className="card"><h3>Still accessible</h3><p>{stillAccessible}</p></article>
          <article className="card"><h3>Recently lost</h3><p>{recentlyLost}</p></article>
          <article className="card"><h3>Cities covered</h3><p>{cityCounts.length}</p></article>
        </div>

        <div className="grid-3">
          <section className="card">
            <h3>By city</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {cityCounts.map((item) => (
                <div key={item.city} className="meta" style={{ justifyContent: "space-between" }}>
                  <span>{item.city}</span><strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h3>By category</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {byCategory.map(([label, count]) => (
                <div key={label} className="meta" style={{ justifyContent: "space-between" }}>
                  <span>{label}</span><strong>{count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h3>By disappearance reason</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {byReason.map(([label, count]) => (
                <div key={label} className="meta" style={{ justifyContent: "space-between" }}>
                  <span>{label}</span><strong>{count}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
