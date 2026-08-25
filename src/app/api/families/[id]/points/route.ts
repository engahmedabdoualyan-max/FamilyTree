import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

const CAPS: Record<string, number> = {
  MEMORY: 30,
  QUIZ: 30,
};

// POST award game points: { reason, points }
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = String(body?.reason ?? "").toUpperCase();
  let points = Math.max(1, Math.min(50, Number(body?.points ?? 0)));
  if (!(reason in CAPS)) return NextResponse.json({ error: "BAD_REASON" }, { status: 400 });

  // daily cap per game
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todaySum = await prisma.pointLog.aggregate({
    where: { familyId: id, userId, reason, createdAt: { gte: startOfDay } },
    _sum: { points: true },
  });
  const used = todaySum._sum.points ?? 0;
  if (used >= CAPS[reason])
    return NextResponse.json({ awarded: 0, capped: true, message: "DAILY_CAP" });

  points = Math.min(points, CAPS[reason] - used);

  await prisma.$transaction([
    prisma.membership.update({
      where: { userId_familyId: { userId, familyId: id } },
      data: { points: { increment: points } },
    }),
    prisma.pointLog.create({
      data: { familyId: id, userId, points, reason },
    }),
  ]);

  return NextResponse.json({ awarded: points, capped: false });
}
