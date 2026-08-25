import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

async function guard(ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { err: 401 as const };
  const { id } = await ctx.params;
  const media = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!media) return { err: 404 as const };
  const membership = await getMembership(media.familyId, userId);
  if (!membership) return { err: 403 as const };
  return { media, userId: userId! };
}

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("err" in g) return NextResponse.json({ error: "DENIED" }, { status: g.err });
  const comments = await prisma.mediaComment.findMany({
    where: { mediaId: g.media.id },
    include: { user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return NextResponse.json({ comments });
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("err" in g) return NextResponse.json({ error: "DENIED" }, { status: g.err });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const text = String(body?.text ?? "").trim().slice(0, 1000);
  if (!text) return NextResponse.json({ error: "EMPTY" }, { status: 400 });
  const comment = await prisma.mediaComment.create({
    data: { mediaId: g.media.id, userId: g.userId, text },
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  if (g.media.uploadedById !== g.userId) {
    notify(
      g.media.uploadedById,
      "COMMENT",
      `${comment.user.name ?? "أحد الأقارب"} علّق على «${g.media.title ?? "صورة"}»`,
      `/family/${g.media.familyId}/gallery`
    );
  }
  return NextResponse.json({ comment }, { status: 201 });
}
