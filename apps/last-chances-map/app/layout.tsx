import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Last Chances Map",
  description: "A map and archive of places, venues, streets, and cultural spaces that may not survive much longer.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-app="last-chances">
      <body>
        <div className="page-shell">
          <header className="site-header">
            <div className="site-header__inner">
              <a className="brand" href="/">Last Chances Map</a>
              <nav className="nav" aria-label="Primary">
                <a href="/map">Map</a>
                <a href="/list">List</a>
                <a href="/stats">Stats</a>
              </nav>
            </div>
          </header>
          {children}
          <div className="footer-space" />
        </div>
      </body>
    </html>
  );
}
