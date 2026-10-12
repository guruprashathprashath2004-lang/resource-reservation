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

  const team = await prisma.team.create({ data: { name: parsed.data } });
  await prisma.auditLog.create({
    data: { action: "TEAM_CREATED", entity: "Team", entityId: team.id, userId: admin.id },
  });

  revalidatePath("/teams");
  return undefined;
}