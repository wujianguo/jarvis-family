import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL is required")
export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})
export * from "@prisma/client"
