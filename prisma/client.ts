import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DB_DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
