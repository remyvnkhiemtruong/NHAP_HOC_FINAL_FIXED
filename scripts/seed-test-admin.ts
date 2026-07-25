import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main(): Promise<void> {
  const username = process.env.TEST_ADMIN_USERNAME ?? "test-admin";
  const password = process.env.TEST_ADMIN_PASSWORD ?? "test-password-2026";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.adminUser.upsert({
    where: { username },
    update: { password_hash: passwordHash, role: "ADMIN", active: true },
    create: {
      username,
      password_hash: passwordHash,
      role: "ADMIN",
      active: true,
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
