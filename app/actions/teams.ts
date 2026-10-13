"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { FormState } from "@/app/actions/auth";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Team name is too short")
  .max(50, "Team name is too long");

export async function createTeam(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await prisma.team.findFirst({
    where: { name: { equals: parsed.data, mode: "insensitive" } },
  });
  if (existing) return { error: "A team with this name already exists." };

  await prisma.$transaction(async (tx) => {
    const team = await tx.team.create({ data: { name: parsed.data } });
    await tx.auditLog.create({
      data: {
        action: "TEAM_CREATED",
        entity: "Team",
        entityId: team.id,
        userId: admin.id,
        details: { name: team.name },
      },
    });
  });

  revalidatePath("/teams");
  return undefined;
}

export async function deleteTeam(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = z.string().min(1, "Missing team id.").safeParse(formData.get("id"));
  if (!id.success) return { error: id.error.issues[0].message };

  const result = await prisma.$transaction(async (tx) => {
    const team = await tx.team.findUnique({ where: { id: id.data } });
    if (!team) return { error: "This team no longer exists." };

    const { count: unassignedMembers } = await tx.user.updateMany({
      where: { teamId: team.id },
      data: { teamId: null },
    });
    await tx.team.delete({ where: { id: team.id } });
    await tx.auditLog.create({
      data: {
        action: "TEAM_DELETED",
        entity: "Team",
        entityId: team.id,
        userId: admin.id,
        details: { name: team.name, unassignedMembers },
      },
    });
    return {};
  });

  if ("error" in result) return result;

  revalidatePath("/teams");
  revalidatePath("/register");
  return undefined;
}