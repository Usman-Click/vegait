// ==============================================
// RateFlow — Dashboard Header
// Top bar with page title and mobile nav toggle
// ==============================================

"use client";

import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";

/** Maps route paths to page titles */
function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/dashboard/clients")) return "Clients";
  if (pathname.startsWith("/dashboard/analytics")) return "Analytics";
  if (pathname.startsWith("/dashboard/health")) return "Health";
  return "Dashboard";
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      {/* Mobile nav toggle (visible on small screens) */}
      <MobileNav />

      {/* Page title */}
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>

      {/* Right side spacer — can add actions here later (e.g., user menu) */}
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          System Online
        </div>
      </div>
    </header>
  );
}
