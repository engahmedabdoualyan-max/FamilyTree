import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

// Link two existing persons as spouses (can bridge two families
// if the user is a member of both families).
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const membership = await getMembership(person.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const spouseId = typeof body?.spouseId === "string" ? body.spouseId : null;
  if (!spouseId || spouseId === id)
    return NextResponse.json({ error: "INVALID_SPOUSE" }, { status: 400 });

  const spouse = await prisma.person.findUnique({ where: { id: spouseId } });
  if (!spouse) return NextResponse.json({ error: "SPOUSE_NOT_FOUND" }, { status: 404 });

  if (spouse.familyId !== person.familyId) {
    const otherMembership = await getMembership(spouse.familyId, userId);
    if (!otherMembership)
      return NextResponse.json(
        { error: "JOIN_OTHER_FAMILY_FIRST", otherFamilyName: null },
        { status: 403 }
      );
  }

  // Prevent linking direct ancestors/descendants as spouses
  const isDirectRelative =
    person.fatherId === spouse.id ||
    person.motherId === spouse.id ||
    spouse.fatherId === person.id ||
    spouse.motherId === person.id;
  if (isDirectRelative)
    return NextResponse.json({ error: "DIRECT_RELATIVE" }, { status: 400 });

  const [aId, bId] = [id, spouseId].sort();
  const link = await prisma.spouseLink.upsert({
    where: { aId_bId: { aId, bId } },
    update: {},
    create: { aId, bId },
  });
  return NextResponse.json({ link }, { status: 201 });
}

// PATCH change marriage status: { spouseId, status: MARRIED | DIVORCED }
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!(await getMembership(person.familyId, userId)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const spouseId = typeof body?.spouseId === "string" ? body.spouseId : null;
  const status = String(body?.status ?? "").toUpperCase();
  if (!spouseId || !["MARRIED", "DIVORCED"].includes(status))
    return NextResponse.json({ error: "INVALID" }, { status: 400 });

  const [aId, bId] = [id, spouseId].sort();
  const link = await prisma.spouseLink.findUnique({ where: { aId_bId: { aId, bId } } });
  if (!link) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.spouseLink.update({ where: { id: link.id }, data: { status } });
  return NextResponse.json({ ok: true });
}

// Unlink spouses
export async function DELETE(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const membership = await getMembership(person.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(req.url);
  const spouseId = url.searchParams.get("spouseId");
  if (!spouseId) return NextResponse.json({ error: "INVALID_SPOUSE" }, { status: 400 });

  const [aId, bId] = [id, spouseId].sort();
  await prisma.spouseLink.deleteMany({ where: { aId, bId } });
  return NextResponse.json({ ok: true });
}
