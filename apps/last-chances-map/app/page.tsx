import { getCityCounts, getFeaturedRecords, getRecentlyLost } from "../lib/records";

export default function HomePage() {
  const featured = getFeaturedRecords().slice(0, 2);
  const recentlyLost = getRecentlyLost(3);
  const cities = getCityCounts();

  return (
    <main>
      <section className="hero">
        <div className="container">
          <h1>Places worth seeing before they disappear.</h1>
          <p>
            A curated archive of venues, streets, shops, and cultural spaces under pressure from closure,
            redevelopment, demolition, or slow decline.
          </p>
          <div className="hero__actions">
            <a className="button" href="/map">Open Map</a>
            <a className="button-secondary" href="/list">Browse List</a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Featured risk</h2>
          <div className="grid-2">
            {featured.map((record) => (
              <article key={record.id} className="card record-card">
                <div className="meta">
                  <span className={`badge badge--${record.urgency}`}>{record.urgency}</span>
                  <span className={`badge ${record.stillAccessible === false ? "badge--lost" : ""}`}>
                    {record.stillAccessible === false ? "recently lost" : "still accessible"}
                  </span>
                </div>
                <h3 className="record-card__title">{record.title}</h3>
                <p className="record-card__summary">{record.summary}</p>
                <div className="record-card__footer meta">
                  <span>{record.city} · {record.area}</span>
                  <a href={`/record/${record.slug}`}>View detail</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Cities in the archive</h2>
          <div className="grid-3">
            {cities.map((city) => (
              <article key={city.city} className="card">
                <h3>{city.city}</h3>
                <p>{city.count} records currently in the archive.</p>
                <a href="/list">Browse city records</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Recently lost</h2>
          <div className="grid-3">
            {recentlyLost.map((record) => (
              <article key={record.id} className="card record-card">
                <div className="meta">
                  <span className="badge badge--lost">recently lost</span>
                  <span className="badge">{record.disappearanceReason}</span>
                </div>
                <h3 className="record-card__title">{record.title}</h3>
                <p className="record-card__summary">{record.summary}</p>
                <div className="record-card__footer meta">
                  <span>{record.city}</span>
                  <a href={`/record/${record.slug}`}>View detail</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
