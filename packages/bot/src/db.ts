import { PrismaClient, type Prisma } from '@prisma/client'

export const prisma = new PrismaClient()

// Re-export Prisma namespace for types
export type { Prisma }
