import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";
import { checkUploadAllowance } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// GET listings ?kind=SELL|GIFT
export async function GET(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await getMembership(id, userId)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");

  const listings = await prisma.listing.findMany({
    where: { familyId: id, ...(kind === "SELL" || kind === "GIFT" ? { kind } : {}) },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { claims: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    listings: listings.map((l) => ({
      id: l.id,
      kind: l.kind,
      title: l.title,
      description: l.description,
      price: l.price,
      photo: l.photo,
      status: l.status,
      createdAt: l.createdAt,
      ownerName: l.createdBy.name,
      ownerId: l.createdById,
      claimsCount: l._count.claims,
      isMine: l.createdById === userId,
    })),
  });
}

// POST create listing
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await getMembership(id, userId)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = String(body?.kind ?? "SELL").toUpperCase() === "GIFT" ? "GIFT" : "SELL";
  const title = String(body?.title ?? "").trim().slice(0, 120);
  const description = String(body?.description ?? "").trim().slice(0, 1000) || null;
  const priceRaw = Number(body?.price ?? 0);
  const price = kind === "SELL" ? Math.max(0, Math.round(priceRaw)) : null;
  let photo: string | null = null;
  if (typeof body?.photo === "string" && body.photo.startsWith("data:image/")) {
    if (body.photo.length > 1_500_000)
      return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
    const storageError = await checkUploadAllowance(id, Math.round(body.photo.length * 0.75));
    if (storageError) return NextResponse.json({ error: storageError }, { status: 507 });
    photo = body.photo;
  }
  if (title.length < 2) return NextResponse.json({ error: "INVALID" }, { status: 400 });

  const listing = await prisma.listing.create({
    data: { familyId: id, kind, title, description, price, photo, createdById: userId },
  });
  return NextResponse.json({ listing }, { status: 201 });
}
