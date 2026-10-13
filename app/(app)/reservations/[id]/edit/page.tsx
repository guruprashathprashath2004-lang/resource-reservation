import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toColomboInputValue } from "@/lib/datetime";
import EditReservationForm from "@/components/EditReservationForm";

export default async function EditReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { resource: true },
  });
  if (!reservation) notFound();

  const isAdmin = user.role === "ADMIN";
  if (reservation.userId !== user.id && !isAdmin) notFound();

  const editable =
    (reservation.status === "PENDING" || reservation.status === "APPROVED") &&
    reservation.startTime > new Date();
  if (!editable) redirect("/reservations");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Edit reservation</h1>
      <EditReservationForm
        id={reservation.id}
        resourceName={reservation.resource.name}
        capacity={reservation.resource.capacity}
        openHour={reservation.resource.openHour}
        closeHour={reservation.resource.closeHour}
        maxDurationMinutes={reservation.resource.maxDurationMinutes}
        title={reservation.title}
        attendeeCount={reservation.attendeeCount}
        notes={reservation.notes}
        start={toColomboInputValue(reservation.startTime)}
        end={toColomboInputValue(reservation.endTime)}
        needsReapproval={!isAdmin && reservation.status === "APPROVED"}
      />
    </div>
  );
}