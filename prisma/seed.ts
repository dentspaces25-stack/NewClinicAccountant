import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPasswordHash = await bcrypt.hash("Admin@123", 12);

  const admin = await prisma.doctor.upsert({
    where: { phone: "+201000000000" },
    update: {},
    create: {
      name: "System Admin",
      phone: "+201000000000",
      email: "admin@clinic-accountant.com",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  console.log("Admin user created/found:", admin.id);
  console.log("Admin login: +201000000000 / Admin@123");
  console.log("IMPORTANT: Change the admin password after first login!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
