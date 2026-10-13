import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatDateLabel, formatDateTime, isValidDateOnly, shiftDate, todayInColombo } from "@/lib/datetime";
import { fitsResourceOpeningHours } from "@/lib/reservation-schedule";

const DAY_MS = 24 * 60 * 60 * 1000;

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidDate(value: string) {
  return isValidDateOnly(value);
}

function isValidTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour < 24 && minute < 60;
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser();

  const raw = await searchParams;
  const rawDate = one(raw.date);
  const today = todayInColombo();
  const date = isValidDate(rawDate) ? rawDate : today;
  const start = one(raw.start);
  const end = one(raw.end);
  const categoryId = one(raw.category);
  const rawAttendees = one(raw.attendees) || "1";
  const hasTimeSearch = Boolean(start || end);

  // Sri Lanka is UTC+05:30 with no daylight saving
  const dayStart = new Date(`${date}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const nextDayEnd = new Date(dayEnd.getTime() + DAY_MS);

  const [resources, reservations] = await Promise.all([
    prisma.resource.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED"] },
        startTime: { lt: nextDayEnd },
        endTime: { gt: dayStart },
      },
      include: { user: { select: { name: true } } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const categories = [...new Map(resources.map((resource) => [resource.category.id, resource.category])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
  const searchErrors: string[] = [];
  let visibleResources = resources;
  let requestedStart: Date | undefined;
  let requestedEnd: Date | undefined;

  if (hasTimeSearch) {
    if (!isValidTime(start) || !isValidTime(end)) {
      searchErrors.push("Choose a valid start and end time.");
    } else {
      requestedStart = new Date(`${date}T${start}:00+05:30`);
      const startMinute = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
      const endMinute = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
      const crossesMidnight = endMinute <= startMinute;
      const endDate = crossesMidnight ? shiftDate(date, 1) : date;
      requestedEnd = new Date(`${endDate}T${end}:00+05:30`);

      if (requestedEnd <= requestedStart) {
        searchErrors.push("End time must be after start time.");
        requestedStart = undefined;
        requestedEnd = undefined;
      } else if (requestedStart < new Date()) {
        searchErrors.push("Choose a time in the future.");
        requestedStart = undefined;
        requestedEnd = undefined;
      }
    }
  }

  const attendeeCount = Number(rawAttendees);
  if (
    !Number.isInteger(attendeeCount) ||
    attendeeCount < 1 ||
    attendeeCount > 1000
  ) {
    searchErrors.push("Number of people must be between 1 and 1,000.");
  }

  if (categoryId && !categories.some((category) => category.id === categoryId)) {
    searchErrors.push("Choose a valid resource category.");
  }

  if (hasTimeSearch && requestedStart && requestedEnd && searchErrors.length === 0) {
    const durationMinutes = (requestedEnd.getTime() - requestedStart.getTime()) / 60000;

    visibleResources = resources.filter((resource) => {
      if (categoryId && resource.categoryId !== categoryId) return false;
      if (resource.capacity < attendeeCount) return false;
      if (!fitsResourceOpeningHours(
        `${date}T${start}`,
        `${shiftDate(date, requestedEnd.getTime() > dayEnd.getTime() ? 1 : 0)}T${end}`,
        resource.openHour,
        resource.closeHour,
      )) return false;
      if (durationMinutes > resource.maxDurationMinutes) return false;

      return !reservations.some(
        (reservation) =>
          reservation.resourceId === resource.id &&
          reservation.startTime < requestedEnd! &&
          reservation.endTime > requestedStart!,
      );
    });
  }

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

  const search = (
    <form
      method="get"
      action="/availability"
      className="mb-4 rounded-xl border border-gray-200 bg-white p-4"
    >
      <h2 className="mb-3 font-semibold">Find an available resource</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="search-date" className="mb-1 block text-xs font-medium text-gray-600">Date</label>
          <input id="search-date" type="date" name="date" required defaultValue={date} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="search-start" className="mb-1 block text-xs font-medium text-gray-600">Start time</label>
          <input id="search-start" type="time" name="start" required defaultValue={start} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="search-end" className="mb-1 block text-xs font-medium text-gray-600">End time</label>
          <input id="search-end" type="time" name="end" required defaultValue={end} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
          <p className="mt-1 text-xs text-gray-500">An end time earlier than the start means the next day.</p>
        </div>
        <div>
          <label htmlFor="search-category" className="mb-1 block text-xs font-medium text-gray-600">Category (optional)</label>
          <select id="search-category" name="category" defaultValue={categoryId} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="search-attendees" className="mb-1 block text-xs font-medium text-gray-600">Number of people</label>
          <input id="search-attendees" type="number" name="attendees" min={1} max={1000} required defaultValue={rawAttendees} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
        </div>
      </div>
      {searchErrors.length > 0 && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchErrors.join(" ")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Find free slots
        </button>
        {hasTimeSearch && (
          <Link href={`/availability?date=${date}`} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100">
            Clear search
          </Link>
        )}
      </div>
    </form>
  );

  if (visibleResources.length === 0) {
    return (
      <div>
        {nav}
        {search}
        {hasTimeSearch && searchErrors.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
            No resources are available for the selected time and requirements.
          </p>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
            No active resources to show.
          </p>
        )}
      </div>
    );
  }

  // Timeline covers the earliest opening hour to the latest closing hour
  const rangeStart = Math.min(...visibleResources.map((r) => r.openHour));
  const rangeEnd = Math.max(...visibleResources.map((r) => r.closeHour));
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
      {search}

      {hasTimeSearch && searchErrors.length === 0 && (
        <p className="mb-3 text-sm text-gray-600">
          {visibleResources.length} resource{visibleResources.length === 1 ? "" : "s"} available from {formatDateTime(requestedStart!)} to {formatDateTime(requestedEnd!)} (Sri Lanka time).
        </p>
      )}

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

          {visibleResources.map((resource) => {
            const rows = reservations.filter(
              (r) =>
                r.resourceId === resource.id &&
                r.startTime < dayEnd &&
                r.endTime > dayStart,
            );
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
                    const visibleStart = new Date(Math.max(r.startTime.getTime(), dayStart.getTime()));
                    const visibleEnd = new Date(Math.min(r.endTime.getTime(), dayEnd.getTime()));
                    const left = pct(minutesOf(visibleStart));
                    const right = pct(minutesOf(visibleEnd));
                    return (
                      <div
                        key={r.id}
                        title={`${r.title} · ${r.user.name} · ${r.attendeeCount}/${resource.capacity} people · ${formatDateTime(r.startTime)}-${formatDateTime(r.endTime)}`}
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