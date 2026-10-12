import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { approveReservation, rejectReservation } from "@/app/actions/reservations";
import { getBusiestResources, getTodayUtilization } from "@/lib/dashboard";
import { formatDateTime, todayInColombo } from "@/lib/datetime";

const card = "rounded-xl border border-gray-200 bg-white p-5";

export default async function AdminDashboard({ name }: { name: string }) {
  const now = new Date();
  const dayStart = new Date(`${todayInColombo()}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [activeResources, userCount, todayCount, pending, pendingCount, utilization, busiest, activity] =
    await Promise.all([
      prisma.resource.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.reservation.count({
        where: { status: { in: ["PENDING", "APPROVED"] }, startTime: { lt: dayEnd }, endTime: { gt: dayStart } },
      }),
      prisma.reservation.findMany({
        where: { status: "PENDING", endTime: { gt: now } },
        include: { resource: true, user: { select: { name: true } } },
        orderBy: { startTime: "asc" },
        take: 5,
      }),
      prisma.reservation.count({ where: { status: "PENDING", endTime: { gt: now } } }),
      getTodayUtilization(),
      getBusiestResources(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { name: true } } },
      }),
    ]);

  const maxCount = busiest[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {name}.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/resources/new" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-100">
            Add resource
          </Link>
          <Link href="/reservations/new" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            New reservation
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className="text-sm text-gray-500">Active resources</p>
          <p className="mt-1 text-3xl font-semibold">{activeResources}</p>
        </div>
        <div className={card}>
          <p className="text-sm text-gray-500">Registered users</p>
          <p className="mt-1 text-3xl font-semibold">{userCount}</p>
        </div>
        <div className={card}>
          <p className="text-sm text-gray-500">Bookings today</p>
          <p className="mt-1 text-3xl font-semibold">{todayCount}</p>
        </div>
        <Link href="/reservations" className={`${card} hover:border-indigo-300`}>
          <p className="text-sm text-gray-500">Pending approvals</p>
          <p className="mt-1 text-3xl font-semibold text-yellow-600">{pendingCount}</p>
        </Link>
      </div>

      <section className={card}>
        <h2 className="mb-3 font-semibold">Needs your approval</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500">No pending requests. You are all caught up.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-gray-500">
                    {r.resource.name} · {r.user.name}
                  </p>
                  <p className="text-gray-500">{formatDateTime(r.startTime)}</p>
                </div>
                <div className="flex gap-2">
                  <form action={approveReservation}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-md bg-green-600 px-3 py-1 text-white hover:bg-green-700">Approve</button>
                  </form>
                  <form action={rejectReservation}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-md border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50">Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Today&apos;s utilization</h2>
            <Link href="/availability" className="text-sm font-medium text-indigo-600 hover:underline">View timeline</Link>
          </div>
          {utilization.length === 0 ? (
            <p className="text-sm text-gray-500">No active resources.</p>
          ) : (
            <ul className="space-y-3">
              {utilization.map((u) => (
                <li key={u.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{u.name}</span>
                    <span className="text-gray-500">{u.percent}%</span>
                  </div>
                  <div className="h-2 rounded bg-gray-100">
                    <div className="h-2 rounded bg-indigo-500" style={{ width: `${Math.min(u.percent, 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className="mb-3 font-semibold">Busiest resources (last 30 days)</h2>
          {busiest.length === 0 ? (
            <p className="text-sm text-gray-500">Not enough booking history yet.</p>
          ) : (
            <ul className="space-y-3">
              {busiest.map((b) => (
                <li key={b.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{b.name}</span>
                    <span className="text-gray-500">{b.count} bookings</span>
                  </div>
                  <div className="h-2 rounded bg-gray-100">
                    <div className="h-2 rounded bg-emerald-500" style={{ width: `${(b.count / maxCount) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={card}>
        <h2 className="mb-3 font-semibold">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-500">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{a.user?.name ?? "System"}</span>{" "}
                  <span className="text-gray-600">{a.action.replaceAll("_", " ").toLowerCase()}</span>
                </span>
                <span className="text-gray-500">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}