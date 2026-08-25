import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

// POST claim a listing ("عايزها") — members only
export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const membership = await getMembership(listing.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (listing.createdById === userId)
    return NextResponse.json({ error: "OWN_LISTING" }, { status: 400 });
  if (listing.status !== "AVAILABLE")
    return NextResponse.json({ error: "NOT_AVAILABLE" }, { status: 400 });

  try {
    await prisma.listingClaim.create({
      data: { listingId: id, userId },
    });
  } catch {
    return NextResponse.json({ error: "ALREADY_CLAIMED" }, { status: 400 });
  }

  notify(
    listing.createdById,
    "MEMBER",
    `${session.user.name ?? "أحد الأقارب"} عايز «${listing.title}» ${listing.kind === "GIFT" ? "🎁" : "🛍️"}`,
    `/family/${listing.familyId}/market`
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
