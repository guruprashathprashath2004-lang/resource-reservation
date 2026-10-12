import AuthForm from "@/components/AuthForm";
import { register } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

export default async function RegisterPage() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <AuthForm mode="register" action={register} teams={teams} />;
}