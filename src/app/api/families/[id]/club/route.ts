import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

// GET club overview: leaderboard + my points + riddles (answers hidden)
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const [leaderboard, riddles, photoKings, riddleGeniuses, firstMember] = await Promise.all([
    prisma.membership.findMany({
      where: { familyId: id },
      orderBy: { points: "desc" },
      take: 20,
      include: { user: { select: { id: true, name: true, image: true } } },
    }),
    prisma.riddle.findMany({
      where: { familyId: id },
      include: {
        solvedBy: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.mediaAsset.groupBy({
      by: ["uploadedById"],
      where: { familyId: id, kind: "PHOTO" },
      _count: { uploadedById: true },
      orderBy: { _count: { uploadedById: "desc" } },
      take: 1,
    }),
    prisma.riddle.groupBy({
      by: ["solvedById"],
      where: { familyId: id, solvedById: { not: null } },
      _count: { solvedById: true },
      orderBy: { _count: { solvedById: "desc" } },
      take: 1,
    }),
    prisma.membership.findFirst({
      where: { familyId: id },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const badges: Record<string, string> = {};
  if (photoKings[0]?.uploadedById) {
    const u = await prisma.user.findUnique({
      where: { id: photoKings[0].uploadedById },
      select: { name: true },
    });
    badges[photoKings[0].uploadedById] = `📸 نجم الصور${u?.name ? ` — ${u.name}` : ""}`;
  }
  if (riddleGeniuses[0]?.solvedById) {
    const u = await prisma.user.findUnique({
      where: { id: riddleGeniuses[0].solvedById },
      select: { name: true },
    });
    badges[riddleGeniuses[0].solvedById] = `🧩 عبقري الألغاز${u?.name ? ` — ${u.name}` : ""}`;
  }
  if (firstMember?.userId) {
    badges[firstMember.userId] = `👑 أول من انضم${firstMember.user.name ? ` — ${firstMember.user.name}` : ""}`;
  }

  const myRank = leaderboard.findIndex((m) => m.userId === userId) + 1;

  return NextResponse.json({
    badges,
    myPoints: membership.points,
    myRank,
    leaderboard: leaderboard.map((m, i) => ({
      userId: m.userId,
      name: m.user.name ?? "?",
      image: m.user.image,
      points: m.points,
      rank: i + 1,
    })),
    riddles: riddles.map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.solvedById || r.createdById === userId ? r.answer : null,
      reward: r.reward,
      solved: !!r.solvedById,
      solverName: r.solvedBy?.name ?? null,
      isMine: r.createdById === userId,
      createdAt: r.createdAt,
    })),
  });
}
