import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string; albumId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id, albumId } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album || album.familyId !== id)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const isAdmin = ["OWNER", "ADMIN"].includes(membership.role);
  if (!isAdmin && album.createdById !== userId)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.album.delete({ where: { id: albumId } });
  return NextResponse.json({ ok: true });
}
