import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const albums = await prisma.album.findMany({
    where: { familyId: id },
    include: {
      _count: { select: { media: true } },
      media: { where: { kind: "PHOTO" }, take: 1, orderBy: { createdAt: "desc" }, select: { fileData: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    albums: albums.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      createdAt: a.createdAt,
      mediaCount: a._count.media,
      cover: a.media[0]?.fileData ?? null,
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const title = String(body?.title ?? "").trim().slice(0, 100);
  if (title.length < 1) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
  const description = String(body?.description ?? "").trim().slice(0, 500) || null;

  const album = await prisma.album.create({
    data: { familyId: id, title, description, createdById: userId },
  });
  return NextResponse.json({ album }, { status: 201 });
}
