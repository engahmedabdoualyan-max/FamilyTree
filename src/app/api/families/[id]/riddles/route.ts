import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

// GET all riddles (full answers — members only page)
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const riddles = await prisma.riddle.findMany({
    where: { familyId: id },
    include: {
      solvedBy: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ riddles });
}

// POST create riddle
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const question = String(body?.question ?? "").trim().slice(0, 500);
  const answer = String(body?.answer ?? "").trim().slice(0, 200);
  const reward = Math.max(5, Math.min(100, Number(body?.reward ?? 10)));
  if (question.length < 5 || !answer)
    return NextResponse.json({ error: "INVALID" }, { status: 400 });

  const riddle = await prisma.riddle.create({
    data: { familyId: id, question, answer, reward, createdById: userId },
    include: {
      solvedBy: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ riddle }, { status: 201 });
}
