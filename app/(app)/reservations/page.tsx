import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  cancelReservation,
  approveReservation,
  rejectReservation,
} from "@/app/actions/reservations";
import { formatDateTime } from "@/lib/datetime";

const badge: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-200 text-gray-600",
  COMPLETED: "bg-blue-100 text-blue-700",
  EXPIRED: "bg-gray-200 text-gray-500",
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
                    {isAdmin && <td className="px-4 py-3">{r.user.name}</td>}
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
      )}
    </div>
  );
}