import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Dev Standards Dashboard" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
          <a href="/catalog">Catalog</a>
          <a href="/conversations">Conversations</a>
          <form action="/logout" method="post" style={{ marginLeft: "auto" }}>
            <button type="submit" style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0, font: "inherit" }}>
              Logout
            </button>
          </form>
        </nav>
        {children}
      </body>
    </html>
  );
}
