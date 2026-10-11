import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { cancelReservation } from "@/app/actions/reservations";
import { formatDateTime } from "@/lib/datetime";

const badge: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-200 text-gray-600",
};

export default async function ReservationsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const reservations = await prisma.reservation.findMany({
    where: isAdmin ? {} : { userId: user.id },
    include: { resource: true, user: { select: { name: true } } },
    orderBy: { startTime: "desc" },
    take: 100,
  });

  const now = new Date();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{isAdmin ? "All reservations" : "My reservations"}</h1>
        <Link href="/reservations/new" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          New reservation
        </Link>
      </div>

      {reservations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          No reservations yet.
        </p>
      ) : (
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
                const cancellable = (r.status === "PENDING" || r.status === "APPROVED") && r.endTime > now;
                return (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium">{r.title}</td>
                    <td className="px-4 py-3">{r.resource.name}</td>
                    {isAdmin && <td className="px-4 py-3">{r.user.name}</td>}
                    <td className="px-4 py-3">{formatDateTime(r.startTime)}</td>
                    <td className="px-4 py-3">{formatDateTime(r.endTime)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs ${badge[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {cancellable && (
                        <form action={cancelReservation}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-100">Cancel</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}