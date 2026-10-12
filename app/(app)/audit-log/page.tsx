import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ACTIONS = [
  { value: "RESERVATION_CREATED", label: "Reservation created" },
  { value: "RESERVATION_APPROVED", label: "Reservation approved" },
  { value: "RESERVATION_REJECTED", label: "Reservation rejected" },
  { value: "RESERVATION_CANCELLED", label: "Reservation cancelled" },
  { value: "RESOURCE_CREATED", label: "Resource created" },
  { value: "RESOURCE_UPDATED", label: "Resource updated" },
  { value: "RESOURCE_ACTIVATED", label: "Resource activated" },
  { value: "RESOURCE_DEACTIVATED", label: "Resource deactivated" },
  { value: "CATEGORY_CREATED", label: "Category created" },
  { value: "CATEGORY_DELETED", label: "Category deleted" },
  { value: "TEAM_CREATED", label: "Team created" },
];

const actionLabel = new Map(ACTIONS.map((a) => [a.value, a.label]));

function tone(action: string) {
  if (/(CREATED|APPROVED|ACTIVATED)$/.test(action)) return "bg-green-100 text-green-700";
  if (/(REJECTED|DELETED|DEACTIVATED)$/.test(action)) return "bg-red-100 text-red-700";
  if (/CANCELLED$/.test(action)) return "bg-gray-200 text-gray-600";
  return "bg-blue-100 text-blue-700";
}

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
  return qs ? `/audit-log?${qs}` : "/audit-log";
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const raw = await searchParams;

  const action = ACTIONS.some((a) => a.value === one(raw.action)) ? one(raw.action) : "";
  const userId = one(raw.user);
  const from = validDate(one(raw.from)) ? one(raw.from) : "";
  const to = validDate(one(raw.to)) ? one(raw.to) : "";
  const requestedPage = Math.max(1, Number.parseInt(one(raw.page), 10) || 1);

  const filters = { action, user: userId, from, to };
  const hasFilters = Object.values(filters).some(Boolean);

  const where: Prisma.AuditLogWhereInput = {};
  if (action) where.action = action;
  if (userId) where.userId = userId;

  // Sri Lanka is UTC+05:30 with no daylight saving
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(`${from}T00:00:00+05:30`) } : {}),
      ...(to ? { lt: new Date(new Date(`${to}T00:00:00+05:30`).getTime() + DAY_MS) } : {}),
    };
  }

  const [total, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { user: { select: { name: true, role: true } } },
  });

  // Turn raw entity ids into readable names (only for the rows on this page)
  const idsOf = (entity: string) => logs.filter((l) => l.entity === entity).map((l) => l.entityId);
  const [reservations, resources, categories, teams] = await Promise.all([
    prisma.reservation.findMany({
      where: { id: { in: idsOf("Reservation") } },
      select: { id: true, title: true, resource: { select: { name: true } } },
    }),
    prisma.resource.findMany({
      where: { id: { in: idsOf("Resource") } },
      select: { id: true, name: true },
    }),
    prisma.resourceCategory.findMany({
      where: { id: { in: idsOf("ResourceCategory") } },
      select: { id: true, name: true },
    }),
    prisma.team.findMany({
      where: { id: { in: idsOf("Team") } },
      select: { id: true, name: true },
    }),
  ]);

  const targets = new Map<string, string>();
  for (const r of reservations) targets.set(`Reservation:${r.id}`, `${r.title} · ${r.resource.name}`);
  for (const r of resources) targets.set(`Resource:${r.id}`, r.name);
  for (const c of categories) targets.set(`ResourceCategory:${c.id}`, c.name);
  for (const t of teams) targets.set(`Team:${t.id}`, t.name);

  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = (page - 1) * PAGE_SIZE + logs.length;

  const field = "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";
  const fieldLabel = "mb-1 block text-xs font-medium text-gray-600";

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-gray-500">Who changed what, and when (Sri Lanka time).</p>
      </div>

      <form
        method="get"
        action="/audit-log"
        className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label htmlFor="action" className={fieldLabel}>Action</label>
          <select id="action" name="action" defaultValue={action} className={`${field} w-full`}>
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="user" className={fieldLabel}>User</label>
          <select id="user" name="user" defaultValue={userId} className={`${field} w-full`}>
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
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
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
          <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Apply filters
          </button>
          {hasFilters && (
            <Link href="/audit-log" className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100">
              Clear
            </Link>
          )}
        </div>
      </form>

      {logs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          {hasFilters ? "No activity matches your filters." : "No activity recorded yet."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDateTime(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      {l.user ? (
                        <>
                          <span className="font-medium">{l.user.name}</span>
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                            {l.user.role}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-500">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs ${tone(l.action)}`}>
                        {actionLabel.get(l.action) ?? l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {targets.get(`${l.entity}:${l.entityId}`) ?? (
                        <span className="text-gray-400">(removed)</span>
                      )}
                    </td>
                  </tr>
                ))}
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