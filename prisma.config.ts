import "dotenv/config";
import { defineConfig } from "prisma/config";

// Plain process.env (with fallback) keeps `prisma generate` — npm postinstall
// on Vercel — working even before DATABASE_URL is configured there.
// env("DATABASE_URL") would hard-throw when missing.
const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url,
  },
});
