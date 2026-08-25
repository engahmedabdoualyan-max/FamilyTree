import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET conversations list: friends + last message + unread count
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const friendships = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: {
      requester: { select: { id: true, name: true, image: true } },
      addressee: { select: { id: true, name: true, image: true } },
    },
  });

  const threads = await Promise.all(
    friendships.map(async (f) => {
      const friend = f.requesterId === userId ? f.addressee : f.requester;
      const last = await prisma.directMessage.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: friend.id },
            { senderId: friend.id, receiverId: userId },
          ],
        },
        orderBy: { createdAt: "desc" },
      });
      const unread = await prisma.directMessage.count({
        where: { senderId: friend.id, receiverId: userId, readAt: null },
      });
      return {
        friend,
        lastText: last?.text ?? null,
        lastAt: last?.createdAt ?? f.createdAt,
        unread,
      };
    })
  );

  threads.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  return NextResponse.json({ threads });
}
