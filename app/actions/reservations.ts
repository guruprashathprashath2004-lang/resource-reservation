"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth";
import type { FormState } from "@/app/actions/auth";

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const schema = z.object({
  resourceId: z.string().min(1, "Select a resource"),
  title: z.string().trim().min(2, "Title is too short").max(100, "Title is too long"),
  notes: z.string().trim().max(500, "Notes are too long").optional(),
  start: z.string().regex(LOCAL, "Enter a valid start time"),
  end: z.string().regex(LOCAL, "Enter a valid end time"),
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

export async function createReservation(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { resourceId, title, notes, start, end } = parsed.data;
  const startTime = toDate(start);
  const endTime = toDate(end);

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

  let reservationId: string;
  try {
    const reservation = await prisma.reservation.create({
      data: {
        title,
        notes: notes || null,
        startTime,
        endTime,
        status: user.role === "ADMIN" ? "APPROVED" : "PENDING",
        resourceId,
        userId: user.id,
      },
    });
    reservationId = reservation.id;
  } catch (e) {
    if (isOverlapError(e)) {
      return { error: "That time slot is already booked for this resource. Please choose another time." };
    }
    throw e;
  }

  await prisma.auditLog.create({
    data: { action: "RESERVATION_CREATED", entity: "Reservation", entityId: reservationId, userId: user.id },
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