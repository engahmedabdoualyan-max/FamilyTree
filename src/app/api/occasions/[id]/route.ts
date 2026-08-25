import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const occasion = await prisma.occasion.findUnique({ where: { id } });
  if (!occasion) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const membership = await getMembership(occasion.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const isAdmin = ["OWNER", "ADMIN"].includes(membership.role);
  if (!isAdmin && occasion.createdById !== userId)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.occasion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
