import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Dev Standards Dashboard" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
          <a href="/catalog">Catalog</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
