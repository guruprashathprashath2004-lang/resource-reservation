import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import NavLinks from "@/components/NavLinks";
import ThemeToggle from "@/components/ThemeToggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="min-h-screen text-gray-900">
      <div className="sticky top-0 z-30 px-3 pt-3">
        <header className="glass-nav mx-auto max-w-6xl rounded-3xl border border-gray-200 bg-white px-4 py-2.5">
          <nav className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className="brand pr-2 text-lg font-semibold">
                Resource Reservation
              </Link>
              <NavLinks isAdmin={isAdmin} />
            </div>

            <div className="flex items-center gap-3 text-sm">
              <ThemeToggle />
              <span className="flex items-center gap-2 text-gray-600">
                {user.name}
                <span className={`role-badge ${isAdmin ? "role-admin" : ""}`}>{user.role}</span>
              </span>
              <form action={logout}>
                <button className="rounded-full border border-gray-300 px-3 py-1.5 hover:bg-gray-100">
                  Logout
                </button>
              </form>
            </div>
          </nav>
        </header>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}