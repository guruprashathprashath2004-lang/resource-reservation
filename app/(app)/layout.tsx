import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold text-indigo-600">Resource Reservation</Link>
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link href="/resources" className="text-sm text-gray-600 hover:text-gray-900">Resources</Link>
            <Link href="/reservations" className="text-sm text-gray-600 hover:text-gray-900">Reservations</Link>
            <Link href="/availability" className="text-sm text-gray-600 hover:text-gray-900">Availability</Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">
              {user.name} <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{user.role}</span>
            </span>
            <form action={logout}>
              <button className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-100">Logout</button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}