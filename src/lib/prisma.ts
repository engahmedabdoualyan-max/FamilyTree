import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type DbClient = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma?: DbClient };

function createClient(): DbClient {
  const url = process.env.DATABASE_URL ?? "";
  const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");
  if (isPostgres) {
    // Hosted Postgres (Supabase / Neon / etc.) — used in production
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter });
  }
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env (local) or Vercel environment variables."
    );
  }
  // Local SQLite file, e.g. "file:./prisma/dev.db"
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

// Lazy client: nothing touches the database (or env vars) until the first
// query, so builds never fail when DATABASE_URL is missing at build time.
export const prisma: DbClient = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const client = globalForPrisma.prisma ?? createClient();
    globalForPrisma.prisma = client;
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
