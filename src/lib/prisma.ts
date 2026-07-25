import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import 'dotenv/config';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

import { encryptionExtension } from './prisma-encryption';

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }).$extends(encryptionExtension) as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
