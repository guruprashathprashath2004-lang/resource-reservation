"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { FormState } from "@/app/actions/auth";
import { Prisma } from "@/app/generated/prisma/client";

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
  await prisma.$transaction(async (tx) => {
    const resource = await tx.resource.create({
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

    await tx.auditLog.create({
      data: {
        action: "RESOURCE_CREATED",
        entity: "Resource",
        entityId: resource.id,
        userId: admin.id,
        details: {
          name: resource.name,
          categoryId: resource.categoryId,
          location: resource.location,
          capacity: resource.capacity,
          isActive: resource.isActive,
          openHour: resource.openHour,
          closeHour: resource.closeHour,
        },
      },
    });
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
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.resource.findUniqueOrThrow({ where: { id } });
      const resource = await tx.resource.update({
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

      await tx.auditLog.create({
        data: {
          action: "RESOURCE_UPDATED",
          entity: "Resource",
          entityId: id,
          userId: admin.id,
          details: {
            before: {
              name: before.name,
              categoryId: before.categoryId,
              location: before.location,
              capacity: before.capacity,
              isActive: before.isActive,
              openHour: before.openHour,
              closeHour: before.closeHour,
              maxDurationMinutes: before.maxDurationMinutes,
            },
            after: {
              name: resource.name,
              categoryId: resource.categoryId,
              location: resource.location,
              capacity: resource.capacity,
              isActive: resource.isActive,
              openHour: resource.openHour,
              closeHour: resource.closeHour,
              maxDurationMinutes: resource.maxDurationMinutes,
            },
          },
        },
      });
    });
  } catch (error) {
    const text = String(error);
    if (text.includes("Resource capacity cannot be reduced below an upcoming reservation attendee count")) {
      return { error: "Capacity cannot be reduced below the number of people on an upcoming booking." };
    }
    throw error;
  }

  revalidatePath("/resources");
  redirect("/resources");
}

export async function toggleResourceActive(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.$transaction(async (tx) => {
    const resource = await tx.resource.findUnique({ where: { id } });
    if (!resource) return;

    const updated = await tx.resource.update({
      where: { id },
      data: { isActive: !resource.isActive },
    });
    await tx.auditLog.create({
      data: {
        action: updated.isActive ? "RESOURCE_ACTIVATED" : "RESOURCE_DEACTIVATED",
        entity: "Resource",
        entityId: id,
        userId: admin.id,
        details: { before: { isActive: resource.isActive }, after: { isActive: updated.isActive } },
      },
    });
  });

  revalidatePath("/resources");
}

export async function deleteResource(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = z.string().min(1, "Missing resource id.").safeParse(formData.get("id"));
  if (!id.success) return { error: id.error.issues[0].message };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const resource = await tx.resource.findUnique({
        where: { id: id.data },
        include: { _count: { select: { reservations: true } } },
      });
      if (!resource) return { error: "This resource no longer exists." };
      if (resource._count.reservations > 0) {
        return {
          error: `Cannot delete ${resource.name} because it has ${resource._count.reservations} reservation(s). Deactivate it to preserve booking history.`,
        };
      }

      await tx.resource.delete({ where: { id: id.data } });
      await tx.auditLog.create({
        data: {
          action: "RESOURCE_DELETED",
          entity: "Resource",
          entityId: id.data,
          userId: admin.id,
          details: {
            name: resource.name,
            categoryId: resource.categoryId,
            location: resource.location,
            capacity: resource.capacity,
            isActive: resource.isActive,
          },
        },
      });
      return {};
    });

    if ("error" in result) return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { error: "This resource now has reservations and cannot be deleted. Deactivate it to preserve booking history." };
    }
    throw error;
  }

  revalidatePath("/resources");
  return undefined;
}
