import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / driver-adapter packages must not be bundled — loaded via
  // native require at runtime instead (required for Vercel builds).
  serverExternalPackages: [
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
    "@prisma/adapter-pg",
    "pg",
  ],
};

export default nextConfig;
