import type { ReactNode } from "react";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata = { title: "Dev Standards Dashboard" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${hankenGrotesk.variable} ${ibmPlexMono.variable}`}
    >
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <a className="wordmark" href="/catalog" aria-label="Dev Standards home">
              <span className="wordmark__mark" aria-hidden="true">§</span>
              <span className="wordmark__text">Dev Standards</span>
              <span className="wordmark__sub">Reference &amp; Review</span>
            </a>
            <nav className="site-nav" aria-label="Primary">
              <a href="/catalog" className="site-nav__link">Catalog</a>
              <a href="/conversations" className="site-nav__link">Conversations</a>
              <form action="/logout" method="post" className="logout-form">
                <button type="submit" className="site-nav__link">Logout</button>
              </form>
            </nav>
          </div>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
