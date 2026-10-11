import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateTime, todayInColombo } from "@/lib/datetime";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const now = new Date();
  const today = todayInColombo();
  // Sri Lanka is UTC+05:30 with no daylight saving
  const dayStart = new Date(`${today}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const since = new Date(now.getTime() - 30 * DAY_MS);

  const [resources, todayReservations, upcoming, pendingCount, recent] = await Promise.all([
    prisma.resource.findMany({ orderBy: { name: "asc" } }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED"] },
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      select: { resourceId: true, startTime: true, endTime: true, status: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED"] },
        endTime: { gt: now },
        ...(isAdmin ? {} : { userId: user.id }),
      },
      include: { resource: true, user: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: 5,
    }),
    isAdmin
      ? prisma.reservation.count({ where: { status: "PENDING", endTime: { gt: now } } })
      : Promise.resolve(0),
    prisma.reservation.findMany({
      where: { status: "APPROVED", startTime: { gte: since, lt: now } },
      select: { resourceId: true },
    }),
  ]);

  const activeResources = resources.filter((r) => r.isActive);

  // Utilization = approved booked time / opening time, for today
  const utilization = activeResources.map((r) => {
    const openStart = dayStart.getTime() + r.openHour * HOUR_MS;
    const openEnd = dayStart.getTime() + r.closeHour * HOUR_MS;
    let booked = 0;
    for (const b of todayReservations) {
      if (b.resourceId !== r.id || b.status !== "APPROVED") continue;
      const s = Math.max(b.startTime.getTime(), openStart);
      const e = Math.min(b.endTime.getTime(), openEnd);
      if (e > s) booked += e - s;
    }
    return { id: r.id, name: r.name, percent: Math.round((booked / (openEnd - openStart)) * 100) };
  });

  // Busiest resources in the last 30 days
  const counts = new Map<string, number>();
  for (const r of recent) counts.set(r.resourceId, (counts.get(r.resourceId) ?? 0) + 1);
  const nameById = new Map(resources.map((r) => [r.id, r.name]));
  const busiest = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, name: nameById.get(id) ?? "Unknown", count }));
  const maxCount = busiest[0]?.count ?? 1;

  const card = "rounded-xl border border-gray-200 bg-white p-5";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <p className="text-sm text-gray-500">Here is what is happening with your resources today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className={card}>
          <p className="text-sm text-gray-500">Active resources</p>
          <p className="mt-1 text-3xl font-semibold">{activeResources.length}</p>
        </div>
        <div className={card}>
          <p className="text-sm text-gray-500">Bookings today</p>
          <p className="mt-1 text-3xl font-semibold">{todayReservations.length}</p>
        </div>
        {isAdmin && (
          <Link href="/reservations" className={`${card} hover:border-indigo-300`}>
            <p className="text-sm text-gray-500">Pending approvals</p>
            <p className="mt-1 text-3xl font-semibold">{pendingCount}</p>
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{isAdmin ? "Upcoming bookings" : "My upcoming bookings"}</h2>
            <Link href="/reservations/new" className="text-sm font-medium text-indigo-600 hover:underline">
              New reservation
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming bookings.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcoming.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-gray-500">
                      {r.resource.name}
                      {isAdmin ? ` · ${r.user.name}` : ""}
                    </p>
                    <p className="text-gray-500">{formatDateTime(r.startTime)}</p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      r.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Today&apos;s utilization</h2>
            <Link href="/availability" className="text-sm font-medium text-indigo-600 hover:underline">
              View timeline
            </Link>
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
      </div>

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
  );
}