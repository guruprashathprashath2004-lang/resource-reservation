import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { createResource } from "@/app/actions/resources";
import ResourceForm from "@/components/ResourceForm";

export default async function NewResourcePage() {
  await requireAdmin();
  const categories = await prisma.resourceCategory.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Add resource</h1>
      <ResourceForm action={createResource} categories={categories} submitLabel="Create resource" />
    </div>
  );
}