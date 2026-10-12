"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth";
import type { FormState } from "@/app/actions/auth";

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const fields = {
  title: z.string().trim().min(2, "Title is too short").max(100, "Title is too long"),
  notes: z.string().trim().max(500, "Notes are too long").optional(),
  start: z.string().regex(LOCAL, "Enter a valid start time"),
  end: z.string().regex(LOCAL, "Enter a valid end time"),
};

const createSchema = z.object({
  resourceId: z.string().min(1, "Select a resource"),
  ...fields,
});

const updateSchema = z.object({
  id: z.string().min(1, "Missing reservation id"),
  ...fields,
});

// Form times are entered in Sri Lanka time (UTC+05:30, no daylight saving)
function toDate(local: string) {
  return new Date(`${local}:00+05:30`);
}

function minutesOfDay(local: string) {
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}

function isOverlapError(e: unknown) {
  let text = String(e);
  try {
    text += JSON.stringify(e, Object.getOwnPropertyNames(e as object));
  } catch {
    // ignore circular structures
  }
  return /reservations_no_overlap|23P01|exclusion constraint/i.test(text);
}

const OVERLAP_MESSAGE =
  "That time slot is already booked for this resource. Please choose another time.";

// Shared rules for creating and editing a reservation
async function checkSlot(resourceId: string, start: string, end: string) {
  const startTime = toDate(start);
  const endTime = toDate(end);

  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return { error: "Enter a valid date and time." };
  }
  if (endTime <= startTime) return { error: "End time must be after start time." };
  if (startTime < new Date()) return { error: "Start time cannot be in the past." };
  if (start.slice(0, 10) !== end.slice(0, 10)) {
    return { error: "A reservation must start and end on the same day." };
  }

  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource || !resource.isActive) return { error: "This resource is not available." };

  if (minutesOfDay(start) < resource.openHour * 60 || minutesOfDay(end) > resource.closeHour * 60) {
    return {
      error: `${resource.name} can only be reserved between ${resource.openHour}:00 and ${resource.closeHour}:00.`,
    };
  }

  const minutes = (endTime.getTime() - startTime.getTime()) / 60000;
  if (minutes > resource.maxDurationMinutes) {
    return { error: `Maximum booking length for ${resource.name} is ${resource.maxDurationMinutes} minutes.` };
  }

  return { startTime, endTime };
}

export async function createReservation(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { resourceId, title, notes, start, end } = parsed.data;
  const slot = await checkSlot(resourceId, start, end);
  if ("error" in slot) return { error: slot.error };

  let reservationId: string;
  try {
    const reservation = await prisma.reservation.create({
      data: {
        title,
        notes: notes || null,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: user.role === "ADMIN" ? "APPROVED" : "PENDING",
        resourceId,
        userId: user.id,
      },
    });
    reservationId = reservation.id;
  } catch (e) {
    if (isOverlapError(e)) return { error: OVERLAP_MESSAGE };
    throw e;
  }

  await prisma.auditLog.create({
    data: { action: "RESERVATION_CREATED", entity: "Reservation", entityId: reservationId, userId: user.id },
  });

  revalidatePath("/reservations");
  redirect("/reservations");
}

export async function updateReservation(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, title, notes, start, end } = parsed.data;

  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) return { error: "Reservation not found." };
  if (existing.userId !== user.id && user.role !== "ADMIN") {
    return { error: "You can only edit your own reservations." };
  }
  if (existing.status !== "PENDING" && existing.status !== "APPROVED") {
    return { error: "This reservation can no longer be edited." };
  }
  if (existing.startTime <= new Date()) {
    return { error: "Only upcoming reservations can be edited." };
  }

  const slot = await checkSlot(existing.resourceId, start, end);
  if ("error" in slot) return { error: slot.error };

  const timeChanged =
    slot.startTime.getTime() !== existing.startTime.getTime() ||
    slot.endTime.getTime() !== existing.endTime.getTime();

  // A member changing the time of an approved booking needs a fresh approval
  const status =
    timeChanged && existing.status === "APPROVED" && user.role !== "ADMIN"
      ? "PENDING"
      : existing.status;

  try {
    await prisma.reservation.update({
      where: { id },
      data: {
        title,
        notes: notes || null,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status,
      },
    });
  } catch (e) {
    if (isOverlapError(e)) return { error: OVERLAP_MESSAGE };
    throw e;
  }

  await prisma.auditLog.create({
    data: { action: "RESERVATION_UPDATED", entity: "Reservation", entityId: id, userId: user.id },
  });

  revalidatePath("/reservations");
  redirect("/reservations");
}

export async function cancelReservation(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) return;
  if (reservation.userId !== user.id && user.role !== "ADMIN") return;
  if (reservation.status === "CANCELLED" || reservation.status === "REJECTED") return;
  if (reservation.endTime <= new Date()) return;

  await prisma.reservation.update({ where: { id }, data: { status: "CANCELLED" } });
  await prisma.auditLog.create({
    data: { action: "RESERVATION_CANCELLED", entity: "Reservation", entityId: id, userId: user.id },
  });

  revalidatePath("/reservations");
}

async function decide(formData: FormData, status: "APPROVED" | "REJECTED") {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  // Only a PENDING reservation can be decided, guards against double clicks
  const result = await prisma.reservation.updateMany({
    where: { id, status: "PENDING" },
    data: { status },
  });
  if (result.count === 0) return;

  await prisma.auditLog.create({
    data: {
      action: status === "APPROVED" ? "RESERVATION_APPROVED" : "RESERVATION_REJECTED",
      entity: "Reservation",
      entityId: id,
      userId: admin.id,
    },
  });

  revalidatePath("/reservations");
}

export async function approveReservation(formData: FormData) {
  await decide(formData, "APPROVED");
}

export async function rejectReservation(formData: FormData) {
  await decide(formData, "REJECTED");
}