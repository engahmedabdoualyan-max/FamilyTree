import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

// GET current linked person for me in this family
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const person = await prisma.person.findFirst({
    where: { familyId: id, linkedUserId: userId },
    select: { id: true, firstName: true, lastName: true },
  });
  return NextResponse.json({ myPersonId: person?.id ?? null });
}

// POST set/unset "this is me"
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const personId = typeof body?.personId === "string" && body.personId ? body.personId : null;

  // clear previous link
  await prisma.person.updateMany({
    where: { familyId: id, linkedUserId: userId },
    data: { linkedUserId: null },
  });

  if (personId) {
    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person || person.familyId !== id)
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    // unlink anyone else already linked to this person
    await prisma.person.updateMany({
      where: { id: personId, NOT: { linkedUserId: null } },
      data: { linkedUserId: null },
    });
    await prisma.person.update({
      where: { id: personId },
      data: { linkedUserId: userId },
    });
  }
  return NextResponse.json({ ok: true, myPersonId: personId });
}
