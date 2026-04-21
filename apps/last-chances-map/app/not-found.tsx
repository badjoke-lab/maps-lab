export default function NotFoundPage() {
  return (
    <main className="section">
      <div className="container">
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2.6rem", margin: "0 0 16px" }}>
          Record not found
        </h1>
        <p style={{ color: "var(--text-muted)", maxWidth: 640 }}>
          The requested archive entry could not be found. It may not exist yet, or the slug may have changed.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          <a className="button" href="/list">Browse archive</a>
          <a className="button-secondary" href="/map">Open map</a>
        </div>
      </div>
    </main>
  );
}
