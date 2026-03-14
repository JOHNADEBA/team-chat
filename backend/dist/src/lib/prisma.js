import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();
const { Pool } = pg;
const globalForPrisma = globalThis;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    process.exit(1);
}
// Create pool with type assertion to bypass the type conflict
const pool = new Pool({
    connectionString: databaseUrl,
}); // Type assertion
const adapter = new PrismaPg(pool);
export const prisma = globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development"
            ? ["query", "info", "warn", "error"]
            : ["error"],
    });
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = prisma;
prisma
    .$connect()
    .then(async () => {
    try {
        await prisma.$queryRaw `SELECT current_database() as db`;
    }
    catch (e) {
        console.error("❌ Can't query database:", e);
    }
})
    .catch((err) => {
    console.error("❌ Prisma connection failed:", err);
    process.exit(1);
});
export default prisma;
//# sourceMappingURL=prisma.js.map