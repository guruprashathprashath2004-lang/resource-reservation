"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/resources", label: "Resources" },
  { href: "/reservations", label: "Reservations" },
  { href: "/availability", label: "Availability" },
  { href: "/teams", label: "Teams", adminOnly: true },
  { href: "/audit-log", label: "Audit log", adminOnly: true },
];

export default function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-1">
      {items
        .filter((i) => !i.adminOnly || isAdmin)
        .map((i) => {
          const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`nav-link rounded-full px-3 py-1.5 text-sm ${active ? "nav-link-active" : ""}`}
            >
              {i.label}
            </Link>
          );
        })}
    </div>
  );
}