import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = RouteContext<"/api/dm/[userId]">;

async function areFriends(a: string, b: string): Promise<boolean> {
  const f = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
  return !!f;
}

// GET thread with a friend
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { userId: id } = await ctx.params;

  if (!(await areFriends(userId, id)))
    return NextResponse.json({ error: "NOT_FRIENDS" }, { status: 403 });

  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: id },
        { senderId: id, receiverId: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  // mark received as read
  await prisma.directMessage.updateMany({
    where: { senderId: id, receiverId: userId, readAt: null },
    data: { readAt: new Date() },
  });

  const friend = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, image: true },
  });
  return NextResponse.json({ messages, friend });
}

// POST send a DM
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { userId: id } = await ctx.params;

  if (!(await areFriends(userId, id)))
    return NextResponse.json({ error: "NOT_FRIENDS" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const text = String(body?.text ?? "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "EMPTY" }, { status: 400 });

  const message = await prisma.directMessage.create({
    data: { senderId: userId, receiverId: id, text },
  });

  // notification for receiver (DND-aware)
  try {
    const recv = await prisma.user.findUnique({
      where: { id },
      select: { dndEnabled: true },
    });
    if (recv && !recv.dndEnabled) {
      const { notify } = await import("@/lib/notify");
      notify(
        id,
        "COMMENT",
        `رسالة خاصة من ${session.user.name ?? "أحد الأقارب"}: ${text.slice(0, 40)}${text.length > 40 ? "…" : ""}`,
        "/messages"
      );
    }
  } catch {}

  return NextResponse.json({ message }, { status: 201 });
}
