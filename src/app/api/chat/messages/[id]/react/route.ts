import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

// POST toggle reaction { emoji }
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const emoji = String(body?.emoji ?? "").slice(0, 8);
  if (!emoji) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const message = await prisma.chatMessage.findUnique({ where: { id } });
  if (!message) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const existing = await prisma.chatReaction.findUnique({
    where: { messageId_userId_emoji: { messageId: id, userId, emoji } },
  });
  if (existing) {
    await prisma.chatReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.chatReaction.create({ data: { messageId: id, userId, emoji } });
  }

  const reactions = await prisma.chatReaction.findMany({
    where: { messageId: id },
    select: { emoji: true, userId: true },
  });
  return NextResponse.json({ reactions });
}
