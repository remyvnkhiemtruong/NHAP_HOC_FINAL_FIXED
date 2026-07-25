import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { validateInitialAdminInput } from "../src/lib/validations/initialAdmin";

async function main(): Promise<void> {
  const { username, password } = validateInitialAdminInput(
    process.env.ADMIN_INITIAL_USERNAME,
    process.env.ADMIN_INITIAL_PASSWORD,
  );
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({
    where: { username },
    update: { password_hash: passwordHash, role: "ADMIN", active: true },
    create: { username, password_hash: passwordHash, role: "ADMIN", active: true },
  });
  console.log(`Khởi tạo ADMIN ${username} hoàn tất. Dữ liệu trúng tuyển được nhập tại /admin/import.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
