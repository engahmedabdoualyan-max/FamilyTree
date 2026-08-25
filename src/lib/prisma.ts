import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type DbClient = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma?: DbClient };

function resolveSqlitePath(rawUrl: string): string {
  const p = rawUrl.startsWith("file:") ? rawUrl.slice(5) : rawUrl;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function createClient(): DbClient {
  const url = process.env.DATABASE_URL ?? "";
  const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");
  if (isPostgres) {
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter });
  }
  const adapter = new PrismaBetterSqlite3({ url: resolveSqlitePath(url) });
  return new PrismaClient({ adapter });
}

export const prisma: DbClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
