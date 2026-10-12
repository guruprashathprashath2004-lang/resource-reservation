"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

export type FormState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  teamId: z.string().optional(),
});

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  const valid = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!user || !valid) return { error: "Invalid email or password." };

  await createSession({ userId: user.id, role: user.role });
  redirect("/dashboard");
}

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists." };

  const teamId = parsed.data.teamId || null;
  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return { error: "The selected team does not exist." };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: "MEMBER",
      teamId,
    },
  });

  await createSession({ userId: user.id, role: user.role });
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}