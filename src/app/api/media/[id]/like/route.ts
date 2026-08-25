import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

// POST toggles like for current user; returns new counts
export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const media = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!media) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const membership = await getMembership(media.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const existing = await prisma.mediaLike.findUnique({
    where: { mediaId_userId: { mediaId: id, userId } },
  });
  if (existing) {
    await prisma.mediaLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.mediaLike.create({ data: { mediaId: id, userId } });
  }
  const [likes, liked] = await Promise.all([
    prisma.mediaLike.count({ where: { mediaId: id } }),
    prisma.mediaLike.findFirst({ where: { mediaId: id, userId } }),
  ]);
  return NextResponse.json({ likes, likedByMe: !!liked });
}
