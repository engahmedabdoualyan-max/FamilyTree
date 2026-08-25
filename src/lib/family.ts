import { prisma } from "@/lib/prisma";

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export async function getMembership(familyId: string, userId: string) {
  return prisma.membership.findUnique({
    where: { userId_familyId: { userId, familyId } },
  });
}

export async function requireRole(familyId: string, userId: string, roles: Role[]) {
  const m = await getMembership(familyId, userId);
  if (!m) return null;
  if (!roles.includes(m.role as Role)) return null;
  return m;
}

export function makeInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
