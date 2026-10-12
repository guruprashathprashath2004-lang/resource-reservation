import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAvailableNow } from "@/lib/dashboard";
import { formatDateTime, todayInColombo } from "@/lib/datetime";

const card = "rounded-xl border border-gray-200 bg-white p-5";

export default async function MemberDashboard({ userId, name }: { userId: string; name: string }) {
  const now = new Date();
  const monthStart = new Date(`${todayInColombo().slice(0, 7)}-01T00:00:00+05:30`);

  const [upcoming, upcomingCount, pendingCount, monthCount, freeNow] = await Promise.all([
    prisma.reservation.findMany({
      where: { userId, status: { in: ["PENDING", "APPROVED"] }, endTime: { gt: now } },
      include: { resource: true },
      orderBy: { startTime: "asc" },
      take: 5,
    }),
    prisma.reservation.count({
      where: { userId, status: { in: ["PENDING", "APPROVED"] }, endTime: { gt: now } },
    }),
    prisma.reservation.count({ where: { userId, status: "PENDING", endTime: { gt: now } } }),
    prisma.reservation.count({
      where: { userId, status: { in: ["PENDING", "APPROVED"] }, startTime: { gte: monthStart } },
    }),
    getAvailableNow(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {name}</h1>
          <p className="text-sm text-gray-500">Your bookings and what is free right now.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/availability" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-100">
            View availability
          </Link>
          <Link href="/reservations/new" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Book a resource
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={card}>
          <p className="text-sm text-gray-500">Upcoming bookings</p>
          <p className="mt-1 text-3xl font-semibold">{upcomingCount}</p>
        </div>
        <div className={card}>
          <p className="text-sm text-gray-500">Waiting for approval</p>
          <p className="mt-1 text-3xl font-semibold text-yellow-600">{pendingCount}</p>
        </div>
        <div className={card}>
          <p className="text-sm text-gray-500">Booked this month</p>
          <p className="mt-1 text-3xl font-semibold">{monthCount}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">My upcoming bookings</h2>
            <Link href="/reservations" className="text-sm font-medium text-indigo-600 hover:underline">View all</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-500">You have no upcoming bookings.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcoming.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-gray-500">{r.resource.name}</p>
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
          <h2 className="mb-3 font-semibold">Free right now</h2>
          {freeNow.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing is free at the moment. Check the timeline for later slots.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {freeNow.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-gray-500">
                      {r.category.name} · {r.capacity} seats
                    </p>
                  </div>
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Free</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}