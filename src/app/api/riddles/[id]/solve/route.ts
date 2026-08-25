import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

// POST solve attempt: { answer }
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  const membership = await getMembershipByRiddle(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const riddle = await prisma.riddle.findUnique({ where: { id } });
  if (!riddle) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (riddle.createdById === userId)
    return NextResponse.json({ error: "OWN_RIDDLE" }, { status: 400 });
  if (riddle.solvedById)
    return NextResponse.json({ error: "ALREADY_SOLVED", solved: true }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const attempt = normalize(String(body?.answer ?? ""));
  const correct = normalize(riddle.answer);
  if (!attempt || !correct.includes(attempt))
    return NextResponse.json({ correct: false });

  // winner!
  await prisma.$transaction([
    prisma.riddle.update({
      where: { id },
      data: { solvedById: userId, solvedAt: new Date() },
    }),
    prisma.membership.update({
      where: { userId_familyId: { userId, familyId: riddle.familyId } },
      data: { points: { increment: riddle.reward } },
    }),
    prisma.pointLog.create({
      data: {
        familyId: riddle.familyId,
        userId,
        points: riddle.reward,
        reason: "RIDDLE",
        refId: riddle.id,
      },
    }),
  ]);

  return NextResponse.json({ correct: true, reward: riddle.reward });
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

async function getMembershipByRiddle(riddleId: string, userId: string) {
  const riddle = await prisma.riddle.findUnique({
    where: { id: riddleId },
    select: { familyId: true },
  });
  if (!riddle) return null;
  return getMembership(riddle.familyId, userId);
}
