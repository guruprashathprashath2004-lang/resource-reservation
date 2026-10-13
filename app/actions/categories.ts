"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { FormState } from "@/app/actions/auth";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Category name is too short")
  .max(50, "Category name is too long");

export async function createCategory(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.resourceCategory.findFirst({
    where: { name: { equals: parsed.data, mode: "insensitive" } },
  });
  if (existing) return { error: "A category with this name already exists." };

  await prisma.$transaction(async (tx) => {
    const category = await tx.resourceCategory.create({ data: { name: parsed.data } });
    await tx.auditLog.create({
      data: {
        action: "CATEGORY_CREATED",
        entity: "ResourceCategory",
        entityId: category.id,
        userId: admin.id,
        details: { name: category.name },
      },
    });
  });

  revalidatePath("/resources/categories");
  return undefined;
}

export async function deleteCategory(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = z.string().min(1, "Missing category id.").safeParse(formData.get("id"));

  if (!id.success) return { error: id.error.issues[0].message };

  const deleted = await prisma.$transaction(async (tx) => {
    const category = await tx.resourceCategory.findUnique({ where: { id: id.data } });
    if (!category) return { error: "This category no longer exists." };

    // A category that still has resources cannot be removed.
    const inUse = await tx.resource.count({ where: { categoryId: id.data } });
    if (inUse > 0) return { error: "This category still has resources and cannot be deleted." };

    await tx.resourceCategory.delete({ where: { id: id.data } });

    await tx.auditLog.create({
      data: {
        action: "CATEGORY_DELETED",
        entity: "ResourceCategory",
        entityId: id.data,
        userId: admin.id,
        details: { name: category.name },
      },
    });
    return {};
  });

  if ("error" in deleted) return deleted;

  revalidatePath("/resources/categories");
  return undefined;
}