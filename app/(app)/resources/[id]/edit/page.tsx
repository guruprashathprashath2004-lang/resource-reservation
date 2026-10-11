import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { updateResource } from "@/app/actions/resources";
import ResourceForm from "@/components/ResourceForm";

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [resource, categories] = await Promise.all([
    prisma.resource.findUnique({ where: { id } }),
    prisma.resourceCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!resource) notFound();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Edit resource</h1>
      <ResourceForm action={updateResource} categories={categories} values={resource} submitLabel="Save changes" />
    </div>
  );
}