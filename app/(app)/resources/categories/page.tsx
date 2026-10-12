import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { deleteCategory } from "@/app/actions/categories";
import CategoryForm from "@/components/CategoryForm";

export default async function CategoriesPage() {
  await requireAdmin();

  const categories = await prisma.resourceCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { resources: true } } },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <Link href="/resources" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to resources
        </Link>
      </div>

      <CategoryForm />

      {categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          No categories yet.
        </p>
      ) : (
        <div className="max-w-xl overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Resources</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">{c._count.resources}</td>
                  <td className="px-4 py-3 text-right">
                    {c._count.resources === 0 ? (
                      <form action={deleteCategory}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="rounded-md border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50">
                          Delete
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-gray-400">In use</span>
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