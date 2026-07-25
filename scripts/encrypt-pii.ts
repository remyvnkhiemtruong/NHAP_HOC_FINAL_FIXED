import { prisma } from "../src/lib/prisma";

async function run() {
  console.log("Starting encryption migration...");
  
  const students = await prisma.student.findMany();
  for (const student of students) {
    const data: Record<string, string> = {};
    if (student.current_cccd && !student.current_cccd.startsWith("enc:v1:")) {
      data.current_cccd = student.current_cccd;
    }
    if (student.current_dob && !student.current_dob.startsWith("enc:v1:")) {
      data.current_dob = student.current_dob;
    }
    
    if (Object.keys(data).length > 0) {
      // Use raw SQL or update to bypass the extension, but here we can just 
      // let the extension handle it? 
      // WAIT! If we use the raw Prisma client (which we just initialized without extension), 
      // we can write directly to the DB!
      await prisma.student.update({
        where: { id: student.id },
        data
      });
      console.log("Encrypted Student " + student.id);
    }
  }

  const families = await prisma.familyMember.findMany();
  for (const family of families) {
    const data: Record<string, string> = {};
    if (family.full_name && !family.full_name.startsWith("enc:v1:")) data.full_name = family.full_name;
    if (family.phone && !family.phone.startsWith("enc:v1:")) data.phone = family.phone;
    if (family.email && !family.email.startsWith("enc:v1:")) data.email = family.email;
    if (family.cccd && !family.cccd.startsWith("enc:v1:")) data.cccd = family.cccd;
    
    if (Object.keys(data).length > 0) {
      await prisma.familyMember.update({
        where: { id: family.id },
        data
      });
      console.log("Encrypted FamilyMember " + family.id);
    }
  }

  console.log("Encryption migration complete!");
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
