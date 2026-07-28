"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Editorial dashboard chrome.
 *
 * Left sidebar (brand + nav + logout) over a warm-paper main area. The login
 * route renders standalone (no sidebar) so the sign-in page stays a focused,
 * full-width surface.
 *
 * The nav is data-driven so future sections (e.g. Review in Chunk 5) are a
 * one-line addition to NAV_ITEMS.
 */

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/catalog", label: "Catalog" },
  { href: "/conversations", label: "Conversations" },
  { href: "/review", label: "Review" },
];

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  if (isLogin) {
    return <main className="dashboard__main">{children}</main>;
  }

  return (
    <div className="dashboard">
      <aside className="sidebar" aria-label="Site">
        <div className="sidebar__brand">
          <a className="sidebar__brand-link" href="/catalog" aria-label="Dev Standards home">
            <span className="sidebar__brand-mark" aria-hidden="true">§</span>
            <span className="sidebar__brand-text">Standards</span>
          </a>
          <p className="sidebar__brand-sub">Reference &amp; Review</p>
        </div>

        <nav className="sidebar__nav" aria-label="Primary">
          <p className="sidebar__nav-heading">Reference</p>
          <ul className="sidebar__nav-list">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={`sidebar__nav-item${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar__footer">
          <form action="/logout" method="post" className="sidebar__logout-form">
            <button type="submit" className="sidebar__logout-btn">Sign out</button>
          </form>
        </div>
      </aside>

      <main className="dashboard__main">{children}</main>
    </div>
  );
}
