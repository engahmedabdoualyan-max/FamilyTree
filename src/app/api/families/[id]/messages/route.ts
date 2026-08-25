import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

// GET: latest chat messages (poll endpoint)
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const messages = await prisma.chatMessage.findMany({
    where: { familyId: id },
    include: {
      user: { select: { id: true, name: true, image: true } },
      reactions: { select: { emoji: true, userId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const text = String(body?.text ?? "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "EMPTY_TEXT" }, { status: 400 });

  const message = await prisma.chatMessage.create({
    data: { familyId: id, userId, text },
    include: {
      user: { select: { id: true, name: true, image: true } },
      reactions: { select: { emoji: true, userId: true } },
    },
  });
  return NextResponse.json({ message }, { status: 201 });
}
