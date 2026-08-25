import { prisma } from "@/lib/prisma";

export async function notify(
  userId: string,
  type: "LIKE" | "COMMENT" | "OCCASION" | "INVITE" | "MEMBER" | "FRIEND" | "APPROVAL",
  text: string,
  link?: string
) {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { dndEnabled: true },
    });
    if (u?.dndEnabled) return; // وضع عدم الإزعاج
    await prisma.notification.create({ data: { userId, type, text, link: link ?? null } });
  } catch {
    // notifications must never break the main action
  }
}

/** Notify every member of a family except one user. */
export async function notifyFamily(
  familyId: string,
  exceptUserId: string,
  type: "OCCASION" | "INVITE" | "MEMBER" | "APPROVAL",
  text: string,
  link?: string
) {
  try {
    const members = await prisma.membership.findMany({
      where: { familyId, userId: { not: exceptUserId }, user: { dndEnabled: false } },
      select: { userId: true },
    });
    if (!members.length) return;
    await prisma.notification.createMany({
      data: members.map((m) => ({ userId: m.userId, type, text, link: link ?? null })),
    });
  } catch {
    // ignore
  }
}
