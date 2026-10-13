import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toggleResourceActive } from "@/app/actions/resources";
import { deleteResource } from "@/app/actions/resources";
import DeleteConfirmationForm from "@/components/DeleteConfirmationForm";

export default async function ResourcesPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const resources = await prisma.resource.findMany({
    where: isAdmin ? {} : { isActive: true },
    include: { category: true, _count: { select: { reservations: true } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Resources</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <Link href="/resources/categories" className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-100">
              Manage categories
            </Link>
            <Link href="/resources/new" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Add resource
            </Link>
          </div>
        )}
      </div>

      {resources.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          No resources yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{r.category.name}</td>
                  <td className="px-4 py-3">{r.location ?? "-"}</td>
                  <td className="px-4 py-3">{r.capacity}</td>
                  <td className="px-4 py-3">{r.openHour}:00 - {r.closeHour}:00</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin && (
                      <div className="flex justify-end gap-2">
                        <Link href={`/resources/${r.id}/edit`} className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-100">Edit</Link>
                        <form action={toggleResourceActive}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-100">
                            {r.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                        {r._count.reservations === 0 ? (
                          <DeleteConfirmationForm
                            action={deleteResource}
                            id={r.id}
                            confirmMessage={`Permanently delete "${r.name}"? This resource has no reservation history.`}
                          />
                        ) : (
                          <span className="self-center text-xs text-gray-400">
                            {r._count.reservations} booking{r._count.reservations === 1 ? "" : "s"} — deactivate to keep history
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}