"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { FormState } from "@/app/actions/auth";

const resourceSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short"),
    categoryId: z.string().min(1, "Select a category"),
    location: z.string().trim().optional(),
    description: z.string().trim().optional(),
    capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(1000),
    openHour: z.coerce.number().int().min(0).max(23),
    closeHour: z.coerce.number().int().min(1).max(24),
    maxDurationMinutes: z.coerce.number().int().min(15, "Minimum 15 minutes").max(1440),
  })
  .refine((d) => d.closeHour > d.openHour, {
    message: "Closing hour must be after opening hour",
    path: ["closeHour"],
  });

export async function createResource(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = resourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const resource = await prisma.resource.create({
    data: {
      name: d.name,
      categoryId: d.categoryId,
      location: d.location || null,
      description: d.description || null,
      capacity: d.capacity,
      openHour: d.openHour,
      closeHour: d.closeHour,
      maxDurationMinutes: d.maxDurationMinutes,
    },
  });

  await prisma.auditLog.create({
    data: { action: "RESOURCE_CREATED", entity: "Resource", entityId: resource.id, userId: admin.id },
  });

  revalidatePath("/resources");
  redirect("/resources");
}

export async function updateResource(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing resource id." };

  const parsed = resourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  await prisma.resource.update({
    where: { id },
    data: {
      name: d.name,
      categoryId: d.categoryId,
      location: d.location || null,
      description: d.description || null,
      capacity: d.capacity,
      openHour: d.openHour,
      closeHour: d.closeHour,
      maxDurationMinutes: d.maxDurationMinutes,
    },
  });

  await prisma.auditLog.create({
    data: { action: "RESOURCE_UPDATED", entity: "Resource", entityId: id, userId: admin.id },
  });

  revalidatePath("/resources");
  redirect("/resources");
}

export async function toggleResourceActive(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const resource = await prisma.resource.findUnique({ where: { id } });
  if (!resource) return;

  await prisma.resource.update({ where: { id }, data: { isActive: !resource.isActive } });
  await prisma.auditLog.create({
    data: {
      action: resource.isActive ? "RESOURCE_DEACTIVATED" : "RESOURCE_ACTIVATED",
      entity: "Resource",
      entityId: id,
      userId: admin.id,
    },
  });

  revalidatePath("/resources");
}
