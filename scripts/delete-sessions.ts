import { prisma } from '../src/lib/prisma'

async function main() {
  await prisma.studentAccessSession.deleteMany()
  console.log('Deleted all StudentAccessSession records to allow migration.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
