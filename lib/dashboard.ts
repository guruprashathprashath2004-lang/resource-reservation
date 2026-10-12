import { prisma } from "@/lib/prisma";
import { todayInColombo } from "@/lib/datetime";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Sri Lanka is UTC+05:30 with no daylight saving
function colomboDayStart() {
  return new Date(`${todayInColombo()}T00:00:00+05:30`);
}

export async function getTodayUtilization() {
  const dayStart = colomboDayStart();
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  const [resources, bookings] = await Promise.all([
    prisma.resource.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.reservation.findMany({
      where: { status: "APPROVED", startTime: { lt: dayEnd }, endTime: { gt: dayStart } },
      select: { resourceId: true, startTime: true, endTime: true },
    }),
  ]);

  return resources.map((r) => {
    const openStart = dayStart.getTime() + r.openHour * HOUR_MS;
    const openEnd = dayStart.getTime() + r.closeHour * HOUR_MS;
    let booked = 0;
    for (const b of bookings) {
      if (b.resourceId !== r.id) continue;
      const s = Math.max(b.startTime.getTime(), openStart);
      const e = Math.min(b.endTime.getTime(), openEnd);
      if (e > s) booked += e - s;
    }
    return { id: r.id, name: r.name, percent: Math.round((booked / (openEnd - openStart)) * 100) };
  });
}

export async function getBusiestResources(days = 30) {
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY_MS);

  const [rows, resources] = await Promise.all([
    prisma.reservation.findMany({
      where: { status: "APPROVED", startTime: { gte: since, lt: now } },
      select: { resourceId: true },
    }),
    prisma.resource.findMany({ select: { id: true, name: true } }),
  ]);

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.resourceId, (counts.get(r.resourceId) ?? 0) + 1);
  const names = new Map(resources.map((r) => [r.id, r.name]));

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, name: names.get(id) ?? "Unknown", count }));
}

// Active resources that are open now and have no booking running right now
export async function getAvailableNow() {
  const now = new Date();
  const hour =
    Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", hour: "2-digit", hour12: false }).format(now),
    ) % 24;

  const [resources, busy] = await Promise.all([
    prisma.resource.findMany({
      where: { isActive: true, openHour: { lte: hour }, closeHour: { gt: hour } },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.reservation.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] }, startTime: { lte: now }, endTime: { gt: now } },
      select: { resourceId: true },
    }),
  ]);

  const busyIds = new Set(busy.map((b) => b.resourceId));
  return resources.filter((r) => !busyIds.has(r.id));
}