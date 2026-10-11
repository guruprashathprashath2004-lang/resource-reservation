import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const engineering = await prisma.team.upsert({
    where: { name: "Engineering" },
    update: {},
    create: { name: "Engineering" },
  });
  const marketing = await prisma.team.upsert({
    where: { name: "Marketing" },
    update: {},
    create: { name: "Marketing" },
  });

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { name: "Admin User", email: "admin@example.com", passwordHash, role: "ADMIN", teamId: engineering.id },
  });
  await prisma.user.upsert({
    where: { email: "member@example.com" },
    update: {},
    create: { name: "Member User", email: "member@example.com", passwordHash, role: "MEMBER", teamId: marketing.id },
  });

  const categoryNames = ["Meeting Room", "Equipment", "Vehicle", "Sports Facility"];
  const categories: Record<string, string> = {};
  for (const name of categoryNames) {
    const c = await prisma.resourceCategory.upsert({ where: { name }, update: {}, create: { name } });
    categories[name] = c.id;
  }

  if ((await prisma.resource.count()) === 0) {
    await prisma.resource.createMany({
      data: [
        { name: "Boardroom", categoryId: categories["Meeting Room"], capacity: 12, location: "Floor 3", description: "Large meeting room with projector" },
        { name: "Huddle Room A", categoryId: categories["Meeting Room"], capacity: 4, location: "Floor 2" },
        { name: "Projector", categoryId: categories["Equipment"], capacity: 1, location: "IT Store" },
        { name: "Company Van", categoryId: categories["Vehicle"], capacity: 8, location: "Parking", openHour: 6, closeHour: 20 },
        { name: "Badminton Court", categoryId: categories["Sports Facility"], capacity: 4, location: "Annex", openHour: 6, closeHour: 21, maxDurationMinutes: 120 },
      ],
    });
  }

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());