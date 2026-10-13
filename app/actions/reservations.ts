"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth";
import { fitsResourceOpeningHours, parseColomboDateTime } from "@/lib/reservation-schedule";
import type { FormState } from "@/app/actions/auth";

const fields = {
  title: z.string().trim().min(2, "Title is too short").max(100, "Title is too long"),
  notes: z.string().trim().max(500, "Notes are too long").optional(),
  attendeeCount: z.coerce.number().int().min(1, "At least one person must attend").max(1000, "Attendee count is too high"),
  start: z.string().min(1, "Enter a valid start time"),
  end: z.string().min(1, "Enter a valid end time"),
};

const createSchema = z.object({
  resourceId: z.string().min(1, "Select a resource"),
  ...fields,
});

const updateSchema = z.object({
  id: z.string().min(1, "Missing reservation id"),
  ...fields,
});

function isOverlapError(e: unknown) {
  let text = String(e);
  try {
    text += JSON.stringify(e, Object.getOwnPropertyNames(e as object));
  } catch {
    // ignore circular structures
  }
  return /reservations_no_overlap|23P01|exclusion constraint/i.test(text);
}

function isAttendeeCapacityError(e: unknown) {
  let text = String(e);
  if (typeof e === "object" && e !== null) {
    try {
      text += JSON.stringify(e, Object.getOwnPropertyNames(e));
    } catch {
      // ignore circular structures
    }
  }
  return /reservation_attendee_capacity|reservation has \d+ attendees but resource capacity is \d+/i.test(text);
}

const OVERLAP_MESSAGE =
  "That time slot is already booked for this resource. Please choose another time.";
const CAPACITY_MESSAGE =
  "The attendee count exceeds this resource's capacity. Choose fewer attendees or a larger resource.";

// Shared rules for creating and editing a reservation
async function checkSlot(resourceId: string, start: string, end: string, attendeeCount: number) {
  const startTime = parseColomboDateTime(start);
  const endTime = parseColomboDateTime(end);
  if (!startTime || !endTime) {
    return { error: "Enter a valid date and time." };
  }
  if (endTime <= startTime) return { error: "End time must be after start time." };
  if (startTime < new Date()) return { error: "Start time cannot be in the past." };

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { name: true, capacity: true, isActive: true, openHour: true, closeHour: true, maxDurationMinutes: true },
  });
  if (!resource || !resource.isActive) return { error: "This resource is not available." };
  if (attendeeCount > resource.capacity) {
    return {
      error: `${resource.name} has capacity for ${resource.capacity} people. Reduce the attendee count or choose a larger resource.`,
    };
  }

  if (!fitsResourceOpeningHours(start, end, resource.openHour, resource.closeHour)) {
    return {
      error: `${resource.name} can only be reserved between ${resource.openHour}:00 and ${resource.closeHour}:00 each day. An overnight reservation requires the resource to stay open until midnight and be open again at the end time.`,
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

  const { resourceId, title, notes, attendeeCount, start, end } = parsed.data;
  const slot = await checkSlot(resourceId, start, end, attendeeCount);
  if ("error" in slot) return { error: slot.error };

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          title,
          notes: notes || null,
          attendeeCount,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: user.role === "ADMIN" ? "APPROVED" : "PENDING",
          resourceId,
          userId: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "RESERVATION_CREATED",
          entity: "Reservation",
          entityId: created.id,
          userId: user.id,
          details: {
            title,
            resourceId,
            attendeeCount,
            startTime: slot.startTime.toISOString(),
            endTime: slot.endTime.toISOString(),
            status: created.status,
          },
        },
      });
    });
  } catch (e) {
    if (isOverlapError(e)) return { error: OVERLAP_MESSAGE };
    if (isAttendeeCapacityError(e)) return { error: CAPACITY_MESSAGE };
    throw e;
  }

  revalidatePath("/reservations");
  redirect("/reservations");
}

export async function updateReservation(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, title, notes, attendeeCount, start, end } = parsed.data;

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

  const slot = await checkSlot(existing.resourceId, start, end, attendeeCount);
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
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id },
        data: {
          title,
          notes: notes || null,
          attendeeCount,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "RESERVATION_UPDATED",
          entity: "Reservation",
          entityId: id,
          userId: user.id,
          details: {
            before: {
              title: existing.title,
              notes: existing.notes,
              attendeeCount: existing.attendeeCount,
              startTime: existing.startTime.toISOString(),
              endTime: existing.endTime.toISOString(),
              status: existing.status,
            },
            after: {
              title,
              notes: notes || null,
              attendeeCount,
              startTime: slot.startTime.toISOString(),
              endTime: slot.endTime.toISOString(),
              status,
            },
          },
        },
      });
    });
  } catch (e) {
    if (isOverlapError(e)) return { error: OVERLAP_MESSAGE };
    if (isAttendeeCapacityError(e)) return { error: CAPACITY_MESSAGE };
    throw e;
  }

  revalidatePath("/reservations");
  redirect("/reservations");
}

export async function cancelReservation(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const cancelled = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id } });
    if (!reservation) return false;
    if (reservation.userId !== user.id && user.role !== "ADMIN") return false;
    if (reservation.status !== "PENDING" && reservation.status !== "APPROVED") return false;

    const result = await tx.reservation.updateMany({
      where: {
        id,
        status: reservation.status,
        endTime: { gt: new Date() },
      },
      data: { status: "CANCELLED" },
    });
    if (result.count === 0) return false;

    await tx.auditLog.create({
      data: {
        action: "RESERVATION_CANCELLED",
        entity: "Reservation",
        entityId: id,
        userId: user.id,
        details: { previousStatus: reservation.status, newStatus: "CANCELLED" },
      },
    });
    return true;
  });

  if (cancelled) revalidatePath("/reservations");
}

async function decide(formData: FormData, status: "APPROVED" | "REJECTED") {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const decided = await prisma.$transaction(async (tx) => {
    const result = await tx.reservation.updateMany({
      where: { id, status: "PENDING" },
      data: { status },
    });
    if (result.count === 0) return false;

    await tx.auditLog.create({
      data: {
        action: status === "APPROVED" ? "RESERVATION_APPROVED" : "RESERVATION_REJECTED",
        entity: "Reservation",
        entityId: id,
        userId: admin.id,
        details: { previousStatus: "PENDING", newStatus: status },
      },
    });
    return true;
  });

  if (decided) revalidatePath("/reservations");
}

export async function approveReservation(formData: FormData) {
  await decide(formData, "APPROVED");
}

export async function rejectReservation(formData: FormData) {
  await decide(formData, "REJECTED");
}