import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import {
  cancelReservation,
  approveReservation,
  rejectReservation,
} from "@/app/actions/reservations";
import { formatDateTime } from "@/lib/datetime";

const PAGE_SIZE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved (upcoming)" },
  { value: "COMPLETED", label: "Completed" },
  { value: "EXPIRED", label: "Expired" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

const badge: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-200 text-gray-600",
  COMPLETED: "bg-blue-100 text-blue-700",
  EXPIRED: "bg-gray-200 text-gray-500",
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: string) {
  return DATE_PATTERN.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function buildHref(params: Record<string, string>, page: number) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/reservations?${qs}` : "/reservations";
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const raw = await searchParams;

  const q = one(raw.q).slice(0, 100);
  const status = STATUS_OPTIONS.some((s) => s.value === one(raw.status)) ? one(raw.status) : "";
  const resourceId = one(raw.resource);
  const from = validDate(one(raw.from)) ? one(raw.from) : "";
  const to = validDate(one(raw.to)) ? one(raw.to) : "";
  const requestedPage = Math.max(1, Number.parseInt(one(raw.page), 10) || 1);

  const now = new Date();
  const filters = { q, status, resource: resourceId, from, to };
  const hasFilters = Object.values(filters).some(Boolean);

  const and: Prisma.ReservationWhereInput[] = [];
  if (!isAdmin) and.push({ userId: user.id });

  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        ...(isAdmin ? [{ user: { name: { contains: q, mode: "insensitive" as const } } }] : []),
      ],
    });
  }
  if (resourceId) and.push({ resourceId });

  // Sri Lanka is UTC+05:30 with no daylight saving
  if (from) and.push({ startTime: { gte: new Date(`${from}T00:00:00+05:30`) } });
  if (to) {
    and.push({ startTime: { lt: new Date(new Date(`${to}T00:00:00+05:30`).getTime() + DAY_MS) } });
  }

  // COMPLETED and EXPIRED are derived from the end time, they are not stored
  switch (status) {
    case "PENDING":
      and.push({ status: "PENDING", endTime: { gt: now } });
      break;
    case "APPROVED":
      and.push({ status: "APPROVED", endTime: { gt: now } });
      break;
    case "COMPLETED":
      and.push({ status: "APPROVED", endTime: { lte: now } });
      break;
    case "EXPIRED":
      and.push({ status: "PENDING", endTime: { lte: now } });
      break;
    case "REJECTED":
    case "CANCELLED":
      and.push({ status });
      break;
  }

  const where: Prisma.ReservationWhereInput = and.length ? { AND: and } : {};

  const [total, resources] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.resource.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const reservations = await prisma.reservation.findMany({
    where,
    include: {
      resource: true,
      user: { select: { name: true, team: { select: { name: true } } } },
    },
    orderBy: { startTime: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = (page - 1) * PAGE_SIZE + reservations.length;

  const field = "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";
  const fieldLabel = "mb-1 block text-xs font-medium text-gray-600";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {isAdmin ? "All reservations" : "My reservations"}
        </h1>
        <Link
          href="/reservations/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New reservation
        </Link>
      </div>

      <form
        method="get"
        action="/reservations"
        className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="lg:col-span-2">
          <label htmlFor="q" className={fieldLabel}>Search</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder={isAdmin ? "Title or person" : "Title"}
            className={`${field} w-full`}
          />
        </div>
        <div>
          <label htmlFor="status" className={fieldLabel}>Status</label>
          <select id="status" name="status" defaultValue={status} className={`${field} w-full`}>
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="resource" className={fieldLabel}>Resource</label>
          <select id="resource" name="resource" defaultValue={resourceId} className={`${field} w-full`}>
            <option value="">All</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className={fieldLabel}>From</label>
          <input id="from" name="from" type="date" defaultValue={from} className={`${field} w-full`} />
        </div>
        <div>
          <label htmlFor="to" className={fieldLabel}>To</label>
          <input id="to" name="to" type="date" defaultValue={to} className={`${field} w-full`} />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
          <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Apply filters
          </button>
          {hasFilters && (
            <Link href="/reservations" className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100">
              Clear
            </Link>
          )}
        </div>
      </form>

      {reservations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          {hasFilters ? "No reservations match your filters." : "No reservations yet."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Resource</th>
                  {isAdmin && <th className="px-4 py-3">Booked by</th>}
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const ended = r.endTime <= now;
                  const active = r.status === "PENDING" || r.status === "APPROVED";
                  const displayStatus =
                    ended && r.status === "APPROVED"
                      ? "COMPLETED"
                      : ended && r.status === "PENDING"
                        ? "EXPIRED"
                        : r.status;

                  return (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 font-medium">{r.title}</td>
                      <td className="px-4 py-3">{r.resource.name}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {r.user.name}
                          {r.user.team && (
                            <div className="text-xs text-gray-500">{r.user.team.name}</div>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">{formatDateTime(r.startTime)}</td>
                      <td className="px-4 py-3">{formatDateTime(r.endTime)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs ${badge[displayStatus]}`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {isAdmin && r.status === "PENDING" && !ended && (
                            <>
                              <form action={approveReservation}>
                                <input type="hidden" name="id" value={r.id} />
                                <button className="rounded-md bg-green-600 px-2 py-1 text-white hover:bg-green-700">
                                  Approve
                                </button>
                              </form>
                              <form action={rejectReservation}>
                                <input type="hidden" name="id" value={r.id} />
                                <button className="rounded-md border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50">
                                  Reject
                                </button>
                              </form>
                            </>
                          )}

                          {active && r.startTime > now && (
                            <Link
                              href={`/reservations/${r.id}/edit`}
                              className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-100"
                            >
                              Edit
                            </Link>
                          )}

                          {active && !ended && (
                            <form action={cancelReservation}>
                              <input type="hidden" name="id" value={r.id} />
                              <button className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-100">
                                Cancel
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
            <p>
              Showing {firstRow}-{lastRow} of {total}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link href={buildHref(filters, page - 1)} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-100">
                  Previous
                </Link>
              ) : (
                <span className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-300">Previous</span>
              )}
              <span>
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={buildHref(filters, page + 1)} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-100">
                  Next
                </Link>
              ) : (
                <span className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-300">Next</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}