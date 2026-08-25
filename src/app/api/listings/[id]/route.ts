import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

// PATCH status: AVAILABLE -> CLAIMED/DONE (owner or admin)
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const membership = await getMembership(listing.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const isStaff = ["OWNER", "ADMIN"].includes(membership.role);
  if (listing.createdById !== userId && !isStaff)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const status = String(body?.status ?? "").toUpperCase();
  if (!["AVAILABLE", "CLAIMED", "DONE"].includes(status))
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });

  await prisma.listing.update({ where: { id }, data: { status } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const membership = await getMembership(listing.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const isStaff = ["OWNER", "ADMIN"].includes(membership.role);
  if (listing.createdById !== userId && !isStaff)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.listing.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
