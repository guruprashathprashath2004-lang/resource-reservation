import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import ReservationForm from "@/components/ReservationForm";

export default async function NewReservationPage() {
  await requireUser();
  const resources = await prisma.resource.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, capacity: true, openHour: true, closeHour: true, maxDurationMinutes: true },
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">New reservation</h1>
      {resources.length === 0 ? (
        <p className="text-gray-500">No resources are available to book right now.</p>
      ) : (
        <ReservationForm resources={resources} />
      )}
    </div>
  );
}