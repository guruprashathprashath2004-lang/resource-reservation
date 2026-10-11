import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateLabel, formatTime, shiftDate, todayInColombo } from "@/lib/datetime";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireUser();

  const { date: rawDate } = await searchParams;
  const today = todayInColombo();
  const valid =
    rawDate && DATE_PATTERN.test(rawDate) && !Number.isNaN(new Date(`${rawDate}T00:00:00Z`).getTime());
  const date = valid ? rawDate : today;

  // Sri Lanka is UTC+05:30 with no daylight saving
  const dayStart = new Date(`${date}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  const [resources, reservations] = await Promise.all([
    prisma.resource.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED"] },
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      include: { user: { select: { name: true } } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const nav = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">Availability</h1>
        <p className="text-sm text-gray-500">{formatDateLabel(date)} (Sri Lanka time)</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/availability?date=${shiftDate(date, -1)}`} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-100">
          Previous
        </Link>
        <Link href={`/availability?date=${today}`} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-100">
          Today
        </Link>
        <Link href={`/availability?date=${shiftDate(date, 1)}`} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-100">
          Next
        </Link>
        <form method="get" action="/availability" className="flex items-center gap-2">
          <input type="date" name="date" defaultValue={date} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
          <button className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">Go</button>
        </form>
      </div>
    </div>
  );

  if (resources.length === 0) {
    return (
      <div>
        {nav}
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          No active resources to show.
        </p>
      </div>
    );
  }

  // Timeline covers the earliest opening hour to the latest closing hour
  const rangeStart = Math.min(...resources.map((r) => r.openHour));
  const rangeEnd = Math.max(...resources.map((r) => r.closeHour));
  const totalMinutes = (rangeEnd - rangeStart) * 60;
  const hours = Array.from({ length: rangeEnd - rangeStart }, (_, i) => rangeStart + i);

  const pct = (minutesOfDay: number) => {
    const clamped = Math.min(Math.max(minutesOfDay, rangeStart * 60), rangeEnd * 60);
    return ((clamped - rangeStart * 60) / totalMinutes) * 100;
  };
  const minutesOf = (d: Date) => (d.getTime() - dayStart.getTime()) / 60000;

  return (
    <div>
      {nav}

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-indigo-500" /> Approved</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-yellow-400" /> Pending approval</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-200" /> Closed</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-gray-300 bg-white" /> Free</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <div className="min-w-[800px]">
          <div className="flex border-b border-gray-200 bg-gray-50">
            <div className="w-48 shrink-0 px-4 py-2 text-xs font-medium text-gray-500">Resource</div>
            <div className="relative h-8 flex-1">
              {hours.map((h) => (
                <span
                  key={h}
                  className="absolute top-2 -translate-x-1/2 text-xs text-gray-500"
                  style={{ left: `${pct(h * 60)}%` }}
                >
                  {h}:00
                </span>
              ))}
            </div>
          </div>

          {resources.map((resource) => {
            const rows = reservations.filter((r) => r.resourceId === resource.id);
            return (
              <div key={resource.id} className="flex border-b border-gray-100 last:border-0">
                <div className="w-48 shrink-0 px-4 py-2">
                  <div className="text-sm font-medium">{resource.name}</div>
                  <div className="text-xs text-gray-500">
                    {resource.category.name} · {resource.capacity} seats
                  </div>
                </div>

                <div className="relative h-14 flex-1">
                  {hours.map((h) => (
                    <div key={h} className="absolute inset-y-0 border-l border-gray-100" style={{ left: `${pct(h * 60)}%` }} />
                  ))}

                  <div className="absolute inset-y-0 bg-gray-200/70" style={{ left: 0, width: `${pct(resource.openHour * 60)}%` }} />
                  <div className="absolute inset-y-0 bg-gray-200/70" style={{ left: `${pct(resource.closeHour * 60)}%`, right: 0 }} />

                  {rows.map((r) => {
                    const left = pct(minutesOf(r.startTime));
                    const right = pct(minutesOf(r.endTime));
                    return (
                      <div
                        key={r.id}
                        title={`${r.title} · ${r.user.name} · ${formatTime(r.startTime)}-${formatTime(r.endTime)}`}
                        className={`absolute inset-y-1.5 overflow-hidden whitespace-nowrap rounded px-1.5 py-1 text-xs ${
                          r.status === "APPROVED" ? "bg-indigo-500 text-white" : "bg-yellow-400 text-yellow-950"
                        }`}
                        style={{ left: `${left}%`, width: `${Math.max(right - left, 0.5)}%` }}
                      >
                        {r.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <Link href="/reservations/new" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Book a slot
        </Link>
      </div>
    </div>
  );
}