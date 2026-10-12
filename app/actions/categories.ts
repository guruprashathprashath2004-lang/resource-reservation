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

  const category = await prisma.resourceCategory.create({ data: { name: parsed.data } });
  await prisma.auditLog.create({
    data: {
      action: "CATEGORY_CREATED",
      entity: "ResourceCategory",
      entityId: category.id,
      userId: admin.id,
    },
  });

  revalidatePath("/resources/categories");
  return undefined;
}

export async function deleteCategory(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  // A category that still has resources cannot be removed
  const inUse = await prisma.resource.count({ where: { categoryId: id } });
  if (inUse > 0) return;

  const result = await prisma.resourceCategory.deleteMany({ where: { id } });
  if (result.count === 0) return;

  await prisma.auditLog.create({
    data: {
      action: "CATEGORY_DELETED",
      entity: "ResourceCategory",
      entityId: id,
      userId: admin.id,
    },
  });

  revalidatePath("/resources/categories");
}